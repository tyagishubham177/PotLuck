import { randomUUID } from "node:crypto";

import { WebSocket, type RawData } from "ws";

import {
  adminOtpRequestResponseSchema,
  authSessionResponseSchema,
  buyInResponseSchema,
  clientSnapshotSchema,
  handTranscriptSchema,
  joinRoomResponseSchema,
  ledgerEntrySchema,
  realtimeServerMessageSchema,
  roomBalanceSummarySchema,
  roomCreateResponseSchema,
  roomRealtimeSnapshotSchema,
  seatReservationResponseSchema,
  type RealtimeServerMessage
} from "@potluck/contracts";

type DurationSummary = {
  count: number;
  averageMs: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

type SyntheticRoomSoakThresholds = {
  maxActionAckP95Ms: number;
  minReconnectSuccessRate: number;
  maxRoomPauses: number;
};

export type SyntheticRoomSoakReport = {
  startedAt: string;
  finishedAt: string;
  roomId: string;
  roomCode: string;
  playersCreated: number;
  handsCompleted: number;
  roomPauses: number;
  reconnect: {
    attempted: number;
    successful: number;
    successRate: number;
  };
  actionAcknowledgementLatency: DurationSummary;
  failedReleaseGates: string[];
};

type SyntheticRoomSoakConfig = {
  serverOrigin: string;
  adminEmail: string;
  resolveAdminOtp: (input: { challengeId: string; email: string }) => Promise<string>;
  playerCount?: number;
  handsToPlay?: number;
  reconnectEveryHands?: number;
  buyInAmount?: number;
  thresholds?: Partial<SyntheticRoomSoakThresholds>;
};

type QueuedRealtimeEvent = {
  playerIndex: number;
  message: RealtimeServerMessage;
  receivedAtMs: number;
};

type Waiter = {
  predicate: (event: QueuedRealtimeEvent) => boolean;
  resolve: (event: QueuedRealtimeEvent) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type PlayerConnection = {
  index: number;
  seatIndex: number;
  nickname: string;
  guestId: string;
  cookieJar: CookieJar;
  socket?: WebSocket;
  accessToken: string;
};

const ACCESS_COOKIE_NAME = "potluck_access_token";

const defaultThresholds: SyntheticRoomSoakThresholds = {
  maxActionAckP95Ms: 300,
  minReconnectSuccessRate: 0.95,
  maxRoomPauses: 0
};

class CookieJar {
  private readonly cookies = new Map<string, string>();

  mergeFromResponse(response: Response) {
    const headers = response.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookieHeaders = headers.getSetCookie?.() ?? [];

    for (const header of setCookieHeaders) {
      const [cookiePair] = header.split(";", 1);

      if (!cookiePair) {
        continue;
      }

      const separatorIndex = cookiePair.indexOf("=");

      if (separatorIndex < 0) {
        continue;
      }

      const key = cookiePair.slice(0, separatorIndex).trim();
      const value = cookiePair.slice(separatorIndex + 1).trim();
      this.cookies.set(key, decodeURIComponent(value));
    }
  }

  toHeaderValue() {
    return [...this.cookies.entries()]
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("; ");
  }

  get(name: string) {
    return this.cookies.get(name);
  }
}

function summarizeDurations(values: number[]): DurationSummary {
  if (values.length === 0) {
    return {
      count: 0,
      averageMs: 0,
      minMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      maxMs: 0
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (ratio: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] ?? 0;
  const total = sorted.reduce((sum, value) => sum + value, 0);

  return {
    count: sorted.length,
    averageMs: Number((total / sorted.length).toFixed(2)),
    minMs: sorted[0] ?? 0,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: sorted.at(-1) ?? 0
  };
}

function toWebSocketUrl(serverOrigin: string, accessToken: string) {
  const url = new URL(serverOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = `accessToken=${encodeURIComponent(accessToken)}`;
  return url.toString();
}

async function expectJson<T>(
  response: Response,
  parser: { parse: (value: unknown) => T },
  label: string
) {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }

  return parser.parse(payload);
}

function evaluateSyntheticRoomSoakReport(
  report: Omit<SyntheticRoomSoakReport, "failedReleaseGates">,
  thresholds: SyntheticRoomSoakThresholds
) {
  const failedReleaseGates: string[] = [];

  if (report.actionAcknowledgementLatency.p95Ms > thresholds.maxActionAckP95Ms) {
    failedReleaseGates.push(
      `P95 action acknowledgement latency ${report.actionAcknowledgementLatency.p95Ms}ms exceeded ${thresholds.maxActionAckP95Ms}ms.`
    );
  }

  if (report.roomPauses > thresholds.maxRoomPauses) {
    failedReleaseGates.push(
      `Observed ${report.roomPauses} paused rooms, which exceeds the allowed maximum of ${thresholds.maxRoomPauses}.`
    );
  }

  if (
    report.reconnect.attempted > 0 &&
    report.reconnect.successRate < thresholds.minReconnectSuccessRate
  ) {
    failedReleaseGates.push(
      `Reconnect success rate ${Math.round(report.reconnect.successRate * 100)}% is below the minimum ${Math.round(thresholds.minReconnectSuccessRate * 100)}%.`
    );
  }

  return failedReleaseGates;
}

export function createSyntheticRoomSoakThresholds(
  overrides: Partial<SyntheticRoomSoakThresholds> = {}
) {
  return {
    ...defaultThresholds,
    ...overrides
  };
}

export async function runSyntheticRoomSoak(config: SyntheticRoomSoakConfig) {
  const playerCount = config.playerCount ?? 2;
  const handsToPlay = config.handsToPlay ?? 3;
  const reconnectEveryHands = config.reconnectEveryHands ?? 0;
  const buyInAmount = config.buyInAmount ?? 5000;
  const thresholds = createSyntheticRoomSoakThresholds(config.thresholds);
  const startedAt = new Date();
  const adminCookies = new CookieJar();
  const actionLatencyMs: number[] = [];
  const queuedEvents: QueuedRealtimeEvent[] = [];
  const waiters: Waiter[] = [];
  let roomPauses = 0;
  let reconnectAttempted = 0;
  let reconnectSuccessful = 0;

  const drainQueuedEvent = (predicate: (event: QueuedRealtimeEvent) => boolean) => {
    const index = queuedEvents.findIndex(predicate);

    if (index < 0) {
      return undefined;
    }

    return queuedEvents.splice(index, 1)[0];
  };

  const pushRealtimeEvent = (event: QueuedRealtimeEvent) => {
    if (event.message.type === "ROOM_PAUSED") {
      roomPauses += 1;
    }

    for (let index = 0; index < waiters.length; index += 1) {
      const waiter = waiters[index];

      if (!waiter?.predicate(event)) {
        continue;
      }

      waiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(event);
      return;
    }

    queuedEvents.push(event);
  };

  const waitForEvent = async (
    predicate: (event: QueuedRealtimeEvent) => boolean,
    timeoutMs = 5_000
  ) => {
    const queuedEvent = drainQueuedEvent(predicate);

    if (queuedEvent) {
      return queuedEvent;
    }

    return await new Promise<QueuedRealtimeEvent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiterIndex = waiters.findIndex((waiter) => waiter.resolve === resolve);

        if (waiterIndex >= 0) {
          waiters.splice(waiterIndex, 1);
        }

        reject(new Error("Timed out waiting for realtime soak event."));
      }, timeoutMs);

      waiters.push({
        predicate,
        resolve,
        reject,
        timeout
      });
    });
  };

  const connectPlayerSocket = async (player: PlayerConnection, roomId: string) => {
    const socket = new WebSocket(toWebSocketUrl(config.serverOrigin, player.accessToken));
    player.socket = socket;

    socket.on("message", (rawMessage: RawData) => {
      const parsed = realtimeServerMessageSchema.parse(
        JSON.parse(rawMessage.toString("utf8"))
      );

      pushRealtimeEvent({
        playerIndex: player.index,
        message: parsed,
        receivedAtMs: Date.now()
      });
    });

    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });

    socket.send(JSON.stringify({ type: "ROOM_SUBSCRIBE", roomId }));

    await waitForEvent(
      (event) =>
        event.playerIndex === player.index &&
        event.message.type === "ROOM_SNAPSHOT" &&
        event.message.roomId === roomId
    );
  };

  const closePlayerSocket = async (player: PlayerConnection) => {
    if (!player.socket) {
      return;
    }

    const socket = player.socket;
    player.socket = undefined;

    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
    });
  };

  const adminOtpResponse = await fetch(
    new URL("/api/auth/admin/request-otp", config.serverOrigin),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: config.adminEmail
      })
    }
  );
  const adminOtp = await expectJson(
    adminOtpResponse,
    adminOtpRequestResponseSchema,
    "Admin OTP request"
  );
  const adminOtpCode = await config.resolveAdminOtp({
    challengeId: adminOtp.challengeId,
    email: config.adminEmail
  });
  const verifyResponse = await fetch(
    new URL("/api/auth/admin/verify-otp", config.serverOrigin),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        challengeId: adminOtp.challengeId,
        code: adminOtpCode
      })
    }
  );
  adminCookies.mergeFromResponse(verifyResponse);
  await expectJson(verifyResponse, authSessionResponseSchema, "Admin OTP verify");

  const roomCreateResponse = await fetch(new URL("/api/rooms", config.serverOrigin), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: adminCookies.toHeaderValue()
    },
    body: JSON.stringify({
      tableName: `Synthetic Soak ${randomUUID().slice(0, 8)}`,
      maxSeats: playerCount,
      variant: "HOLD_EM_NL",
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      buyInMode: "BB_MULTIPLE",
      minBuyIn: 40,
      maxBuyIn: 250,
      rakeEnabled: false,
      rakePercent: 0,
      rakeCap: 0,
      oddChipRule: "LEFT_OF_BUTTON",
      spectatorsAllowed: true,
      straddleAllowed: false,
      rebuyEnabled: true,
      topUpEnabled: true,
      seatReservationTimeoutSeconds: 120,
      joinCodeExpiryMinutes: 120,
      waitingListEnabled: true,
      roomMaxDurationMinutes: 720
    })
  });
  const room = await expectJson(roomCreateResponse, roomCreateResponseSchema, "Create room");
  const players: PlayerConnection[] = [];

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
    const nickname = `Soak-${playerIndex + 1}`;
    const playerCookies = new CookieJar();
    const joinResponse = await fetch(
      new URL(`/api/rooms/${room.room.code}/join`, config.serverOrigin),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nickname,
          mode: "PLAYER"
        })
      }
    );
    playerCookies.mergeFromResponse(joinResponse);
    const joinedPlayer = await expectJson(joinResponse, joinRoomResponseSchema, `Join ${nickname}`);

    const reserveResponse = await fetch(
      new URL(`/api/rooms/${room.room.roomId}/seats/${playerIndex}`, config.serverOrigin),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: playerCookies.toHeaderValue()
        },
        body: JSON.stringify({})
      }
    );
    await expectJson(
      reserveResponse,
      seatReservationResponseSchema,
      `Reserve seat ${playerIndex + 1}`
    );

    const buyInResponse = await fetch(
      new URL(`/api/rooms/${room.room.roomId}/buyin`, config.serverOrigin),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: playerCookies.toHeaderValue(),
          "Idempotency-Key": `soak-buyin-${playerIndex + 1}`
        },
        body: JSON.stringify({
          seatIndex: playerIndex,
          amount: buyInAmount
        })
      }
    );
    await expectJson(buyInResponse, buyInResponseSchema, `Buy in ${nickname}`);

    const accessToken = playerCookies.get(ACCESS_COOKIE_NAME);

    if (!accessToken) {
      throw new Error(`Missing access token cookie for ${nickname}.`);
    }

    players.push({
      index: playerIndex,
      seatIndex: playerIndex,
      nickname,
      guestId: joinedPlayer.actor.guestId,
      cookieJar: playerCookies,
      accessToken
    });
  }

  try {
    for (const player of players) {
      await connectPlayerSocket(player, room.room.roomId);
    }

    for (let handNumber = 1; handNumber <= handsToPlay; handNumber += 1) {
      for (const player of players) {
        player.socket?.send(
          JSON.stringify({
            type: "PLAYER_READY",
            roomId: room.room.roomId,
            seatIndex: player.seatIndex
          })
        );
      }

      const turnStartedEvent = await waitForEvent(
        (event) =>
          event.message.type === "TURN_STARTED" &&
          event.message.roomId === room.room.roomId,
        10_000
      );

      if (turnStartedEvent.message.type !== "TURN_STARTED") {
        throw new Error("Expected TURN_STARTED message during soak.");
      }

      const turnStartedMessage = turnStartedEvent.message;
      const actingPlayer = players.find(
        (player) => player.seatIndex === turnStartedMessage.actingSeatIndex
      );

      if (!actingPlayer?.socket) {
        throw new Error("Could not find the acting player socket.");
      }

      if (reconnectEveryHands > 0 && handNumber % reconnectEveryHands === 0) {
        reconnectAttempted += 1;
        await closePlayerSocket(actingPlayer);
        await waitForEvent(
          (event) =>
            event.message.type === "PLAYER_DISCONNECTED" &&
            event.message.participantId === actingPlayer.guestId,
          10_000
        );
        await connectPlayerSocket(actingPlayer, room.room.roomId);
        await waitForEvent(
          (event) =>
            event.message.type === "PLAYER_RECONNECTED" &&
            event.message.participantId === actingPlayer.guestId,
          10_000
        );
        reconnectSuccessful += 1;
      }

      const idempotencyKey = `soak-action-${handNumber}`;
      const actionStartedAt = Date.now();

      actingPlayer.socket.send(
        JSON.stringify({
          type: "ACTION_SUBMIT",
          roomId: room.room.roomId,
          handId: turnStartedMessage.handId,
          seqExpectation: turnStartedMessage.handSeq,
          idempotencyKey,
          actionType: "FOLD"
        })
      );

      await waitForEvent(
        (event) =>
          event.message.type === "ACTION_ACCEPTED" &&
          event.message.idempotencyKey === idempotencyKey,
        10_000
      );
      actionLatencyMs.push(Date.now() - actionStartedAt);

      await waitForEvent(
        (event) =>
          event.message.type === "SETTLEMENT_POSTED" &&
          event.message.handId === turnStartedMessage.handId,
        10_000
      );
    }
  } finally {
    for (const player of players) {
      await closePlayerSocket(player);
    }
  }

  const finishedAt = new Date();
  const reconnectSuccessRate =
    reconnectAttempted === 0 ? 1 : reconnectSuccessful / reconnectAttempted;
  const baseReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    roomId: room.room.roomId,
    roomCode: room.room.code,
    playersCreated: players.length,
    handsCompleted: handsToPlay,
    roomPauses,
    reconnect: {
      attempted: reconnectAttempted,
      successful: reconnectSuccessful,
      successRate: Number(reconnectSuccessRate.toFixed(4))
    },
    actionAcknowledgementLatency: summarizeDurations(actionLatencyMs)
  };

  return {
    ...baseReport,
    failedReleaseGates: evaluateSyntheticRoomSoakReport(baseReport, thresholds)
  } satisfies SyntheticRoomSoakReport;
}

export function createClientSnapshotFixture() {
  return clientSnapshotSchema.parse({
    appName: "PotLuck",
    appOrigin: "http://localhost:3000",
    serverOrigin: "http://localhost:3001",
    status: "foundation-ready"
  });
}

export function createLedgerEntryFixture() {
  return ledgerEntrySchema.parse({
    entryId: "ledger_fixture_001",
    roomId: "room_fixture_001",
    participantId: "guest_fixture_001",
    seatIndex: 0,
    type: "BUY_IN",
    delta: 5000,
    balanceAfter: 5000,
    referenceId: "op_fixture_001",
    idempotencyKey: "fixture-buyin-1",
    createdAt: "2026-03-19T12:00:00.000Z"
  });
}

export function createRoomBalanceSummaryFixture() {
  return roomBalanceSummarySchema.parse({
    roomId: "room_fixture_001",
    participantId: "guest_fixture_001",
    seatIndex: 0,
    buyInCommitted: 5000,
    rebuyCommitted: 0,
    topUpCommitted: 0,
    adjustmentTotal: 0,
    totalCommitted: 5000,
    netBalance: 5000,
    liveStack: 5000
  });
}

export function createRoomRealtimeSnapshotFixture() {
  return roomRealtimeSnapshotSchema.parse({
    room: {
      roomId: "room_fixture_001",
      code: "FIXED1",
      tableName: "Fixture Table",
      status: "OPEN",
      joinLocked: false,
      maxSeats: 2,
      openSeatCount: 0,
      reservedSeatCount: 0,
      occupiedSeatCount: 2,
      participantCount: 2,
      queuedCount: 0,
      spectatorsAllowed: true,
      waitingListEnabled: true,
      joinCodeExpiresAt: "2026-03-19T14:00:00.000Z",
      createdAt: "2026-03-19T12:00:00.000Z",
      closesAt: "2026-03-20T00:00:00.000Z"
    },
    config: {
      tableName: "Fixture Table",
      maxSeats: 2,
      variant: "HOLD_EM_NL",
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      buyInMode: "BB_MULTIPLE",
      minBuyIn: 40,
      maxBuyIn: 250,
      rakeEnabled: false,
      rakePercent: 0,
      rakeCap: 0,
      oddChipRule: "LEFT_OF_BUTTON",
      spectatorsAllowed: true,
      straddleAllowed: false,
      rebuyEnabled: true,
      topUpEnabled: true,
      seatReservationTimeoutSeconds: 120,
      joinCodeExpiryMinutes: 120,
      waitingListEnabled: true,
      roomMaxDurationMinutes: 720
    },
    seats: [
      {
        seatIndex: 0,
        status: "OCCUPIED",
        participantId: "guest_fixture_001",
        nickname: "Alpha",
        stack: 5000
      },
      {
        seatIndex: 1,
        status: "OCCUPIED",
        participantId: "guest_fixture_002",
        nickname: "Bravo",
        stack: 5000
      }
    ],
    waitingList: [],
    participants: [
      {
        participantId: "guest_fixture_001",
        nickname: "Alpha",
        mode: "PLAYER",
        state: "SEATED",
        joinedAt: "2026-03-19T12:00:00.000Z",
        isConnected: true,
        seatIndex: 0,
        isReady: true,
        isSittingOut: false
      },
      {
        participantId: "guest_fixture_002",
        nickname: "Bravo",
        mode: "PLAYER",
        state: "SEATED",
        joinedAt: "2026-03-19T12:00:10.000Z",
        isConnected: true,
        seatIndex: 1,
        isReady: false,
        isSittingOut: false
      }
    ],
    buyInQuote: {
      roomId: "room_fixture_001",
      mode: "BB_MULTIPLE",
      minUnits: 40,
      maxUnits: 250,
      minChips: 4000,
      maxChips: 25000,
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      displayMin: "40 BB = 4,000 chips",
      displayMax: "250 BB = 25,000 chips"
    },
    heroParticipantId: "guest_fixture_001",
    heroSeatIndex: 0,
    canJoinWaitingList: false,
    tablePhase: "BETWEEN_HANDS",
    roomEventNo: 4,
    activeHand: null
  });
}

export function createHandTranscriptFixture() {
  return handTranscriptSchema.parse({
    roomId: "room_fixture_001",
    handId: "hand_fixture_001",
    handNumber: 1,
    buttonSeatIndex: 0,
    smallBlindSeatIndex: 0,
    bigBlindSeatIndex: 1,
    startedAt: "2026-03-19T12:05:00.000Z",
    endedAt: "2026-03-19T12:05:12.000Z",
    board: [],
    deckCommitmentHash: "fixture-hash",
    deckReveal: ["AS", "KH", "QD", "JC"],
    actions: [
      {
        seq: 1,
        seatIndex: 0,
        participantId: "guest_fixture_001",
        street: "PREFLOP",
        actionType: "FOLD",
        contributedAmount: 0,
        totalCommitted: 50,
        streetCommitted: 50
      }
    ],
    forcedCommitments: [
      {
        seatIndex: 0,
        participantId: "guest_fixture_001",
        type: "SMALL_BLIND",
        amount: 50
      },
      {
        seatIndex: 1,
        participantId: "guest_fixture_002",
        type: "BIG_BLIND",
        amount: 100
      }
    ],
    contributions: [
      {
        seatIndex: 0,
        participantId: "guest_fixture_001",
        totalCommitted: 50,
        contributedByStreet: {
          PREFLOP: 50,
          FLOP: 0,
          TURN: 0,
          RIVER: 0
        }
      },
      {
        seatIndex: 1,
        participantId: "guest_fixture_002",
        totalCommitted: 100,
        contributedByStreet: {
          PREFLOP: 100,
          FLOP: 0,
          TURN: 0,
          RIVER: 0
        }
      }
    ],
    settlement: {
      handId: "hand_fixture_001",
      handNumber: 1,
      oddChipRule: "LEFT_OF_BUTTON",
      rakeConfig: {
        enabled: false,
        percent: 0,
        cap: 0,
        mode: "PER_HAND"
      },
      totalPot: 150,
      totalRake: 0,
      awardedByFold: true,
      showdownResults: [],
      pots: [
        {
          potIndex: 0,
          potType: "MAIN",
          capLevel: 50,
          amount: 100,
          contributorSeatIndexes: [0, 1],
          eligibleSeatIndexes: [1],
          rakeApplied: 0,
          winnerSeatIndexes: [1],
          oddChipSeatIndexes: [],
          awards: [
            {
              seatIndex: 1,
              participantId: "guest_fixture_002",
              amount: 100
            }
          ]
        },
        {
          potIndex: 1,
          potType: "SIDE",
          capLevel: 100,
          amount: 50,
          contributorSeatIndexes: [1],
          eligibleSeatIndexes: [1],
          rakeApplied: 0,
          winnerSeatIndexes: [1],
          oddChipSeatIndexes: [],
          awards: [
            {
              seatIndex: 1,
              participantId: "guest_fixture_002",
              amount: 50
            }
          ]
        }
      ],
      playerResults: [
        {
          seatIndex: 0,
          participantId: "guest_fixture_001",
          contributed: 50,
          won: 0,
          finalStack: 4950,
          netResult: -50
        },
        {
          seatIndex: 1,
          participantId: "guest_fixture_002",
          contributed: 100,
          won: 150,
          finalStack: 5050,
          netResult: 50
        }
      ]
    },
    ledgerEntries: [
      {
        entryId: "ledger_fixture_payout_001",
        roomId: "room_fixture_001",
        participantId: "guest_fixture_002",
        seatIndex: 1,
        type: "HAND_PAYOUT",
        delta: 150,
        balanceAfter: 5150,
        referenceId: "settlement_fixture_001",
        createdAt: "2026-03-19T12:05:12.000Z"
      }
    ],
    auditEvents: [
      {
        eventId: "audit_fixture_001",
        type: "HAND_SETTLED",
        occurredAt: "2026-03-19T12:05:12.000Z",
        actorId: "admin_fixture_001",
        detail: "Hand 1 settled with 150 chips"
      }
    ]
  });
}

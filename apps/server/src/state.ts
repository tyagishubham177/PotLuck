import { createHash, randomInt, randomUUID } from "node:crypto";

import {
  adminOtpRequestResponseSchema,
  buyInResponseSchema,
  buyInQuoteResponseSchema,
  handHistoryListResponseSchema,
  handHistorySummarySchema,
  handSettlementSchema,
  handTranscriptSchema,
  lobbySnapshotSchema,
  queueEntrySchema,
  rebuyResponseSchema,
  roomActionAffordancesSchema,
  roomConfigSchema,
  roomCreateResponseSchema,
  roomDiffPatchSchema,
  roomPrivateStateSchema,
  roomPublicSummarySchema,
  roomBalanceSummarySchema,
  roomRealtimeSnapshotSchema,
  seatReservationResponseSchema,
  topUpResponseSchema,
  type AuthActor,
  type ErrorCode,
  type HandSettlement,
  type HandTranscript,
  type LedgerEntry,
  type LobbySnapshot,
  type RoomActionAffordances,
  type RoomConfig,
  type RoomDiffPatch,
  type RoomJoinMode,
  type RoomPrivateState,
  type RoomRealtimeSnapshot,
  type RoomTablePhase,
  type RoomBalanceSummary,
  type SessionEnvelope,
  type SessionRole
} from "@potluck/contracts";
import {
  HoldemEngineError,
  applyHoldemAction as applyHoldemEngineAction,
  getHandSequence,
  getLegalActions as getHoldemLegalActions,
  getPlayerHoleCards,
  settleHoldemHand,
  startHoldemHand,
  type HoldemHandState
} from "@potluck/game-engine";

import { type EmailAdapter } from "./email.js";
import { appError } from "./errors.js";
import { createSignedToken, verifySignedToken } from "./security.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const OTP_REQUEST_LIMIT = 5;
const OTP_VERIFY_LIMIT = 5;
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TURN_DURATION_MS = 15 * 1000;
const TURN_WARNING_MS = 5 * 1000;
const RECONNECT_GRACE_MS = 20 * 1000;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;

type Clock = () => Date;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type OtpChallenge = {
  challengeId: string;
  email: string;
  code: string;
  expiresAt: Date;
  lastSentAt: Date;
  usedAt?: Date;
  verifyAttempts: number;
};

type AuditEvent = {
  eventId: string;
  type: string;
  occurredAt: string;
  roomId?: string;
  handId?: string;
  actorId?: string;
  detail: string;
};

type ParticipantRecord = {
  participantId: string;
  sessionId: string;
  nickname: string;
  mode: RoomJoinMode;
  joinedAt: Date;
  isConnected: boolean;
  isReady: boolean;
  isSittingOut: boolean;
  lastDisconnectedAt?: Date;
  reconnectGraceEndsAt?: Date;
};

type QueueEntryRecord = {
  entryId: string;
  participantId: string;
  nickname: string;
  joinedAt: Date;
};

type SeatRecord = {
  seatIndex: number;
  status: "EMPTY" | "RESERVED" | "OCCUPIED" | "LOCKED_DURING_HAND";
  participantId?: string;
  reservedUntil?: Date;
  stack?: number;
  reservationToken?: string;
};

type LedgerEntryRecord = {
  entryId: string;
  roomId: string;
  participantId: string;
  seatIndex?: number;
  type:
    | "BUY_IN"
    | "REBUY"
    | "TOP_UP"
    | "HAND_PAYOUT"
    | "RAKE"
    | "COMPENSATING_ADJUSTMENT";
  delta: number;
  balanceAfter: number;
  referenceId: string;
  idempotencyKey?: string;
  createdAt: Date;
};

type HandHistoryRecord = {
  transcript: HandTranscript;
  endedAt: Date;
};

type BuyInResponse = ReturnType<typeof buyInResponseSchema.parse>;
type RebuyResponse = ReturnType<typeof rebuyResponseSchema.parse>;
type TopUpResponse = ReturnType<typeof topUpResponseSchema.parse>;
type ChipOperationResponse = BuyInResponse | RebuyResponse | TopUpResponse;
type ChipOperationType = "BUY_IN" | "REBUY" | "TOP_UP";

type IdempotentLedgerOperation = {
  fingerprint: string;
  response: ChipOperationResponse;
};

type CachedActionIntent = {
  fingerprint: string;
  result:
    | {
        outcome: "accepted";
        roomEventNo: number;
        handId: string;
        handSeq: number;
        participantId: string;
        seatIndex: number;
        idempotencyKey: string;
        actionType: "CHECK" | "FOLD" | "CALL" | "BET" | "RAISE" | "ALL_IN" | "TIMEOUT_FOLD";
        normalizedAmount?: number;
      }
    | {
        outcome: "rejected";
        roomEventNo: number;
        handId?: string;
        handSeq?: number;
        idempotencyKey?: string;
        errorCode: ErrorCode;
        message: string;
        expectedSeq?: number;
      };
};

type ActiveHandRecord = {
  engine: HoldemHandState;
  startedAt: Date;
  deadlineAt: Date;
  timerToken: string;
};

type RoomPatchField = keyof RoomDiffPatch;

type RoomEvent =
  | {
      type: "ROOM_DIFF";
      roomId: string;
      roomEventNo: number;
      changed: RoomPatchField[];
      handId?: string;
      handSeq?: number;
    }
  | {
      type: "HAND_STARTED";
      roomId: string;
      roomEventNo: number;
      handId: string;
      handSeq: number;
      handNumber: number;
      actionSeatOrder: number[];
      blindSeatIndexes: number[];
      buttonSeatIndex?: number;
    }
  | {
      type: "TURN_STARTED";
      roomId: string;
      roomEventNo: number;
      handId: string;
      handSeq: number;
      actingSeatIndex: number;
      deadlineAt: string;
      legalActions: RoomActionAffordances;
    }
  | {
      type: "TURN_WARNING";
      roomId: string;
      roomEventNo: number;
      handId: string;
      handSeq: number;
      actingSeatIndex: number;
      secondsRemaining: number;
    }
  | {
      type: "STREET_ADVANCED";
      roomId: string;
      roomEventNo: number;
      handId: string;
      handSeq: number;
      street: "FLOP" | "TURN" | "RIVER";
      board: string[];
      revealedCards: string[];
    }
  | {
      type: "ACTION_ACCEPTED";
      roomId: string;
      roomEventNo: number;
      handId: string;
      handSeq: number;
      participantId: string;
      seatIndex: number;
      idempotencyKey: string;
      actionType: "CHECK" | "FOLD" | "CALL" | "BET" | "RAISE" | "ALL_IN" | "TIMEOUT_FOLD";
      normalizedAmount?: number;
    }
  | {
      type: "SHOWDOWN_TRIGGERED";
      roomId: string;
      roomEventNo: number;
      handId: string;
      handSeq: number;
      board: string[];
      eligibleSeatIndexes: number[];
      revealOrder: number[];
    }
  | {
      type: "SHOWDOWN_RESULT";
      roomId: string;
      roomEventNo: number;
      handId: string;
      handSeq: number;
      awardedByFold: boolean;
      results: HandSettlement["showdownResults"];
      pots: HandSettlement["pots"];
    }
  | {
      type: "SETTLEMENT_POSTED";
      roomId: string;
      roomEventNo: number;
      handId: string;
      handSeq: number;
      settlement: HandSettlement;
      ledgerEntries: LedgerEntry[];
    }
  | {
      type: "ACTION_REJECTED";
      roomId: string;
      roomEventNo: number;
      handId?: string;
      handSeq?: number;
      idempotencyKey?: string;
      errorCode: ErrorCode;
      message: string;
      expectedSeq?: number;
    }
  | {
      type: "PLAYER_DISCONNECTED";
      roomId: string;
      roomEventNo: number;
      participantId: string;
      seatIndex?: number;
      disconnectedAt: string;
      reconnectGraceEndsAt?: string;
    }
  | {
      type: "PLAYER_RECONNECTED";
      roomId: string;
      roomEventNo: number;
      participantId: string;
      seatIndex?: number;
      reconnectedAt: string;
    }
  | {
      type: "ROOM_PAUSED";
      roomId: string;
      roomEventNo: number;
      reason: string;
      recoveryGuidance?: string;
    };

type RoomEventListener = (event: RoomEvent) => void;

type RoomRuntime = {
  subscribers: Set<RoomEventListener>;
  reservationTimers: Map<number, ReturnType<typeof setTimeout>>;
  turnWarningTimer?: ReturnType<typeof setTimeout>;
  turnExpiryTimer?: ReturnType<typeof setTimeout>;
};

type RoomRecord = {
  roomId: string;
  code: string;
  status: "CREATED" | "OPEN" | "PAUSED" | "CLOSED";
  tablePhase: RoomTablePhase;
  adminId: string;
  config: RoomConfig;
  createdAt: Date;
  joinCodeExpiresAt: Date;
  closesAt: Date;
  participants: Map<string, ParticipantRecord>;
  waitingList: QueueEntryRecord[];
  seats: SeatRecord[];
  ledgerEntries: LedgerEntryRecord[];
  processedLedgerOperations: Map<string, IdempotentLedgerOperation>;
  processedActionIntents: Map<string, CachedActionIntent>;
  roomEventNo: number;
  activeHand?: ActiveHandRecord;
  handHistoryIds: string[];
  lastButtonSeatIndex?: number;
  pausedReason?: string;
  pausedTurnRemainingMs?: number;
};

type SessionRecord = {
  sessionId: string;
  tokenId: string;
  refreshTokenId: string;
  role: SessionRole;
  actor: AuthActor;
  issuedAt: Date;
  expiresAt: Date;
  refreshExpiresAt: Date;
  revokedAt?: Date;
};

type AdminProfileRecord = {
  adminId: string;
  email: string;
};

type TokenEnv = {
  SESSION_SIGNING_SECRET: string;
  GUEST_SESSION_SIGNING_SECRET: string;
};

type RequestOtpOptions = {
  email: string;
  ip: string;
  emailAdapter: EmailAdapter;
};

type AuthContext = {
  session: SessionEnvelope;
  actor: AuthActor;
};

type IssueSessionResult = AuthContext & {
  accessToken: string;
  refreshToken: string;
};

type GuestSessionResult = IssueSessionResult & {
  actor: Extract<AuthActor, { role: "GUEST" }>;
  lobbySnapshot: LobbySnapshot;
};

type CreateAppStateOptions = {
  clock?: Clock;
  onLedgerEntryCommitted?: (entry: LedgerEntryRecord) => void;
  onLedgerEntriesCommitted?: (entries: LedgerEntryRecord[]) => void;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeRoomCode = (code: string) => code.trim().toUpperCase();
const normalizeNickname = (nickname: string) => nickname.trim().replace(/\s+/g, " ");
const toIso = (value: Date) => value.toISOString();

function secondsBetween(now: Date, future: Date) {
  return Math.max(0, Math.ceil((future.getTime() - now.getTime()) / 1000));
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return email;
  }

  const visibleLocal =
    localPart.length <= 2
      ? `${localPart[0] ?? "*"}*`
      : `${localPart.slice(0, 2)}***`;

  return `${visibleLocal}@${domain}`;
}

function createSeatMap(maxSeats: number): SeatRecord[] {
  return Array.from({ length: maxSeats }, (_, seatIndex) => ({
    seatIndex,
    status: "EMPTY"
  }));
}

export function createAppState(options: CreateAppStateOptions = {}) {
  const clock = options.clock ?? (() => new Date());
  const adminProfiles = new Map<string, AdminProfileRecord>();
  const otpChallenges = new Map<string, OtpChallenge>();
  const otpChallengeByEmail = new Map<string, string>();
  const rateLimits = new Map<string, RateLimitBucket>();
  const sessions = new Map<string, SessionRecord>();
  const roomsByCode = new Map<string, RoomRecord>();
  const roomsById = new Map<string, RoomRecord>();
  const handHistories = new Map<string, HandHistoryRecord>();
  const roomRuntimes = new Map<string, RoomRuntime>();
  const auditEvents: AuditEvent[] = [];

  function getOrCreateRoomRuntime(roomId: string) {
    const existing = roomRuntimes.get(roomId);

    if (existing) {
      return existing;
    }

    const created: RoomRuntime = {
      subscribers: new Set(),
      reservationTimers: new Map()
    };
    roomRuntimes.set(roomId, created);
    return created;
  }

  function clearTurnTimers(roomId: string) {
    const runtime = roomRuntimes.get(roomId);

    if (!runtime) {
      return;
    }

    if (runtime.turnWarningTimer) {
      clearTimeout(runtime.turnWarningTimer);
      runtime.turnWarningTimer = undefined;
    }

    if (runtime.turnExpiryTimer) {
      clearTimeout(runtime.turnExpiryTimer);
      runtime.turnExpiryTimer = undefined;
    }
  }

  function clearReservationTimer(roomId: string, seatIndex: number) {
    const runtime = roomRuntimes.get(roomId);
    const timeout = runtime?.reservationTimers.get(seatIndex);

    if (!runtime || !timeout) {
      return;
    }

    clearTimeout(timeout);
    runtime.reservationTimers.delete(seatIndex);
  }

  function nextRoomEventNo(room: RoomRecord) {
    room.roomEventNo += 1;
    return room.roomEventNo;
  }

  function emitRoomEvent(roomId: string, event: RoomEvent) {
    const runtime = roomRuntimes.get(roomId);

    if (!runtime) {
      return;
    }

    for (const listener of [...runtime.subscribers]) {
      listener(event);
    }
  }

  function addAuditEvent(event: Omit<AuditEvent, "eventId" | "occurredAt">) {
    auditEvents.push({ eventId: randomUUID(), occurredAt: toIso(clock()), ...event });
  }

  function consumeRateLimit(key: string, limit: number, windowMs: number) {
    const now = clock().getTime();
    const existing = rateLimits.get(key);

    if (!existing || existing.resetAt <= now) {
      rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (existing.count >= limit) {
      throw appError({
        code: "ERR_RATE_LIMITED",
        message: "Too many attempts. Please wait before trying again.",
        statusCode: 429,
        retryable: true,
        details: {
          retryAfterSeconds: String(Math.max(1, Math.ceil((existing.resetAt - now) / 1000)))
        }
      });
    }

    existing.count += 1;
  }

  function generateUniqueRoomCode() {
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      let code = "";

      for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
        code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
      }

      if (!roomsByCode.has(code)) {
        return code;
      }
    }

    throw appError({
      code: "ERR_INTERNAL",
      message: "We could not generate a unique room code.",
      statusCode: 500,
      retryable: true
    });
  }

  function getOrCreateAdminProfile(email: string) {
    const existing = adminProfiles.get(email);

    if (existing) {
      return existing;
    }

    const created = { adminId: `admin_${randomUUID()}`, email };
    adminProfiles.set(email, created);
    return created;
  }

  function createSession(actor: AuthActor, env: TokenEnv): IssueSessionResult {
    const now = clock();
    const expiresAt = new Date(now.getTime() + ACCESS_TTL_MS);
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS);
    const sessionId = `session_${randomUUID()}`;
    const tokenId = randomUUID();
    const refreshTokenId = randomUUID();

    sessions.set(sessionId, {
      sessionId,
      tokenId,
      refreshTokenId,
      role: actor.role,
      actor,
      issuedAt: now,
      expiresAt,
      refreshExpiresAt
    });

    const secret =
      actor.role === "ADMIN"
        ? env.SESSION_SIGNING_SECRET
        : env.GUEST_SESSION_SIGNING_SECRET;

    return {
      session: {
        sessionId,
        role: actor.role,
        issuedAt: toIso(now),
        expiresAt: toIso(expiresAt),
        refreshExpiresAt: toIso(refreshExpiresAt)
      },
      actor,
      accessToken: createSignedToken({
        sessionId,
        tokenId,
        role: actor.role,
        kind: "access",
        issuedAt: now,
        expiresAt,
        secret
      }),
      refreshToken: createSignedToken({
        sessionId,
        tokenId: refreshTokenId,
        role: actor.role,
        kind: "refresh",
        issuedAt: now,
        expiresAt: refreshExpiresAt,
        secret
      })
    };
  }

  function getSessionRecordFromToken(
    token: string | undefined,
    env: TokenEnv,
    kind: "access" | "refresh"
  ) {
    if (!token) {
      return null;
    }

    const payload = verifySignedToken(
      token,
      env.SESSION_SIGNING_SECRET,
      env.GUEST_SESSION_SIGNING_SECRET
    );

    if (!payload || payload.kind !== kind) {
      return null;
    }

    const session = sessions.get(payload.sessionId);
    const now = clock().getTime();

    if (!session || session.revokedAt) {
      return null;
    }

    const expiryMs =
      kind === "access" ? session.expiresAt.getTime() : session.refreshExpiresAt.getTime();
    const tokenId = kind === "access" ? session.tokenId : session.refreshTokenId;

    if (payload.exp * 1000 <= now || expiryMs <= now || payload.tokenId !== tokenId) {
      return null;
    }

    return session;
  }

  function rotateSession(session: SessionRecord, env: TokenEnv): IssueSessionResult {
    const now = clock();
    const expiresAt = new Date(now.getTime() + ACCESS_TTL_MS);
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS);
    const tokenId = randomUUID();
    const refreshTokenId = randomUUID();

    session.tokenId = tokenId;
    session.refreshTokenId = refreshTokenId;
    session.issuedAt = now;
    session.expiresAt = expiresAt;
    session.refreshExpiresAt = refreshExpiresAt;

    const secret =
      session.role === "ADMIN"
        ? env.SESSION_SIGNING_SECRET
        : env.GUEST_SESSION_SIGNING_SECRET;

    return {
      session: {
        sessionId: session.sessionId,
        role: session.role,
        issuedAt: toIso(now),
        expiresAt: toIso(expiresAt),
        refreshExpiresAt: toIso(refreshExpiresAt)
      },
      actor: session.actor,
      accessToken: createSignedToken({
        sessionId: session.sessionId,
        tokenId,
        role: session.role,
        kind: "access",
        issuedAt: now,
        expiresAt,
        secret
      }),
      refreshToken: createSignedToken({
        sessionId: session.sessionId,
        tokenId: refreshTokenId,
        role: session.role,
        kind: "refresh",
        issuedAt: now,
        expiresAt: refreshExpiresAt,
        secret
      })
    };
  }

  function removeParticipantFromRoom(room: RoomRecord, participantId: string) {
    room.waitingList = room.waitingList.filter((entry) => entry.participantId !== participantId);
    let removedSeatIndex: number | undefined;

    for (const seat of room.seats) {
      if (seat.participantId === participantId) {
        removedSeatIndex = seat.seatIndex;
        clearReservationTimer(room.roomId, seat.seatIndex);
        seat.status = "EMPTY";
        seat.participantId = undefined;
        seat.reservedUntil = undefined;
        seat.reservationToken = undefined;
        seat.stack = undefined;
      }
    }

    room.participants.delete(participantId);

    if (
      removedSeatIndex !== undefined &&
      room.activeHand?.engine.seatOrder.includes(removedSeatIndex)
    ) {
      pauseRoomInternal(
        room,
        "A seated player disconnected during an active hand.",
        "Resume after verifying the room state."
      );
    }
  }

  function closeRoomIfExpired(room: RoomRecord) {
    if (room.status !== "CLOSED" && room.closesAt.getTime() <= clock().getTime()) {
      room.status = "CLOSED";
      room.pausedReason = undefined;
      room.activeHand = undefined;
      clearTurnTimers(room.roomId);
    }
  }

  function releaseExpiredReservations(room: RoomRecord) {
    const nowMs = clock().getTime();

    for (const seat of room.seats) {
      if (
        seat.status === "RESERVED" &&
        seat.reservedUntil &&
        seat.reservedUntil.getTime() <= nowMs
      ) {
        clearReservationTimer(room.roomId, seat.seatIndex);
        seat.status = "EMPTY";
        seat.reservedUntil = undefined;
        seat.participantId = undefined;
        seat.reservationToken = undefined;
      }
    }
  }

  function pruneExpiredParticipants(room: RoomRecord) {
    const nowMs = clock().getTime();

    for (const [participantId, participant] of room.participants.entries()) {
      const session = sessions.get(participant.sessionId);

      if (
        !session ||
        session.revokedAt ||
        session.refreshExpiresAt.getTime() <= nowMs
      ) {
        removeParticipantFromRoom(room, participantId);
      }
    }
  }

  function cleanupRoom(room: RoomRecord) {
    closeRoomIfExpired(room);
    releaseExpiredReservations(room);
    pruneExpiredParticipants(room);
  }

  function getRoomRecordByCode(code: string) {
    const room = roomsByCode.get(normalizeRoomCode(code));

    if (!room) {
      throw appError({
        code: "ERR_ROOM_NOT_FOUND",
        message: "That room code is invalid or has expired.",
        statusCode: 404,
        retryable: false
      });
    }

    cleanupRoom(room);

    if (room.joinCodeExpiresAt.getTime() <= clock().getTime()) {
      throw appError({
        code: "ERR_ROOM_NOT_FOUND",
        message: "That room code is invalid or has expired.",
        statusCode: 404,
        retryable: false
      });
    }

    return room;
  }

  function getRoomRecordById(roomId: string) {
    const room = roomsById.get(roomId);

    if (!room) {
      throw appError({
        code: "ERR_ROOM_NOT_FOUND",
        message: "That room no longer exists.",
        statusCode: 404,
        retryable: false
      });
    }

    cleanupRoom(room);
    return room;
  }

  function toRoomSummary(room: RoomRecord) {
    return roomPublicSummarySchema.parse({
      roomId: room.roomId,
      code: room.code,
      tableName: room.config.tableName,
      status: room.status,
      maxSeats: room.config.maxSeats,
      openSeatCount: room.seats.filter((seat) => seat.status === "EMPTY").length,
      reservedSeatCount: room.seats.filter((seat) => seat.status === "RESERVED").length,
      occupiedSeatCount: room.seats.filter((seat) => seat.status === "OCCUPIED").length,
      participantCount: room.participants.size,
      queuedCount: room.waitingList.length,
      spectatorsAllowed: room.config.spectatorsAllowed,
      waitingListEnabled: room.config.waitingListEnabled,
      joinCodeExpiresAt: toIso(room.joinCodeExpiresAt),
      createdAt: toIso(room.createdAt),
      closesAt: toIso(room.closesAt)
    });
  }

  function toBuyInQuote(room: RoomRecord) {
    const usesBigBlindMultiple = room.config.buyInMode === "BB_MULTIPLE";
    const minChips = usesBigBlindMultiple
      ? room.config.minBuyIn * room.config.bigBlind
      : room.config.minBuyIn;
    const maxChips = usesBigBlindMultiple
      ? room.config.maxBuyIn * room.config.bigBlind
      : room.config.maxBuyIn;

    return buyInQuoteResponseSchema.parse({
      roomId: room.roomId,
      mode: room.config.buyInMode,
      minUnits: room.config.minBuyIn,
      maxUnits: room.config.maxBuyIn,
      minChips,
      maxChips,
      smallBlind: room.config.smallBlind,
      bigBlind: room.config.bigBlind,
      ante: room.config.ante,
      displayMin: usesBigBlindMultiple
        ? `${room.config.minBuyIn} BB = ${minChips.toLocaleString()} chips`
        : `${minChips.toLocaleString()} chips`,
      displayMax: usesBigBlindMultiple
        ? `${room.config.maxBuyIn} BB = ${maxChips.toLocaleString()} chips`
        : `${maxChips.toLocaleString()} chips`
    });
  }

  function getChipRange(room: RoomRecord) {
    const quote = toBuyInQuote(room);

    return {
      minChips: quote.minChips,
      maxChips: quote.maxChips
    };
  }

  function getLedgerEntriesForParticipant(room: RoomRecord, participantId: string) {
    return room.ledgerEntries.filter((entry) => entry.participantId === participantId);
  }

  function getCurrentLedgerBalance(room: RoomRecord, participantId: string) {
    return getLedgerEntriesForParticipant(room, participantId).reduce(
      (total, entry) => total + entry.delta,
      0
    );
  }

  function toLedgerEntry(entry: LedgerEntryRecord): LedgerEntry {
    return {
      entryId: entry.entryId,
      roomId: entry.roomId,
      participantId: entry.participantId,
      seatIndex: entry.seatIndex,
      type: entry.type,
      delta: entry.delta,
      balanceAfter: entry.balanceAfter,
      referenceId: entry.referenceId,
      idempotencyKey: entry.idempotencyKey,
      createdAt: toIso(entry.createdAt)
    };
  }

  function toRoomBalanceSummary(room: RoomRecord, participantId: string): RoomBalanceSummary {
    const ledgerEntries = getLedgerEntriesForParticipant(room, participantId);
    const seat = getParticipantSeat(room, participantId);

    let buyInCommitted = 0;
    let rebuyCommitted = 0;
    let topUpCommitted = 0;
    let adjustmentTotal = 0;

    for (const entry of ledgerEntries) {
      if (entry.type === "BUY_IN") {
        buyInCommitted += entry.delta;
        continue;
      }

      if (entry.type === "REBUY") {
        rebuyCommitted += entry.delta;
        continue;
      }

      if (entry.type === "TOP_UP") {
        topUpCommitted += entry.delta;
        continue;
      }

      adjustmentTotal += entry.delta;
    }

    const totalCommitted = buyInCommitted + rebuyCommitted + topUpCommitted;
    const netBalance = totalCommitted + adjustmentTotal;

    return roomBalanceSummarySchema.parse({
      roomId: room.roomId,
      participantId,
      seatIndex: seat?.seatIndex,
      buyInCommitted,
      rebuyCommitted,
      topUpCommitted,
      adjustmentTotal,
      totalCommitted,
      netBalance,
      liveStack: seat?.stack ?? 0
    });
  }

  function getCachedLedgerOperation(
    room: RoomRecord,
    participantId: string,
    operation: ChipOperationType,
    idempotencyKey: string | undefined,
    fingerprint: string
  ) {
    if (!idempotencyKey) {
      return null;
    }

    const cacheKey = `${participantId}:${operation}:${idempotencyKey}`;
    const cached = room.processedLedgerOperations.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.fingerprint !== fingerprint) {
      throw appError({
        code: "ERR_ACTION_INVALID",
        message: "That idempotency key was already used for a different request.",
        statusCode: 409,
        retryable: false
      });
    }

    return cached.response;
  }

  function storeLedgerOperation(
    room: RoomRecord,
    participantId: string,
    operation: ChipOperationType,
    idempotencyKey: string | undefined,
    fingerprint: string,
    response: ChipOperationResponse
  ) {
    if (!idempotencyKey) {
      return;
    }

    const cacheKey = `${participantId}:${operation}:${idempotencyKey}`;
    room.processedLedgerOperations.set(cacheKey, {
      fingerprint,
      response
    });
  }

  function commitLedgerEntry(
    room: RoomRecord,
    payload: {
      participantId: string;
      seatIndex?: number;
      type: LedgerEntryRecord["type"];
      delta: number;
      idempotencyKey?: string;
      referenceId?: string;
    }
  ) {
    return commitLedgerEntries(room, [payload])[0]!;
  }

  function commitLedgerEntries(
    room: RoomRecord,
    payloads: Array<{
      participantId: string;
      seatIndex?: number;
      type: LedgerEntryRecord["type"];
      delta: number;
      idempotencyKey?: string;
      referenceId?: string;
    }>
  ) {
    const balances = new Map<string, number>();
    const createdAt = clock();
    const entries = payloads.map((payload) => {
      const currentBalance =
        balances.get(payload.participantId) ?? getCurrentLedgerBalance(room, payload.participantId);
      const balanceAfter = currentBalance + payload.delta;

      if (balanceAfter < 0) {
        throw appError({
          code: "ERR_INTERNAL",
          message: "Ledger balance cannot go negative.",
          statusCode: 500,
          retryable: false
        });
      }

      balances.set(payload.participantId, balanceAfter);

      return {
        entryId: `ledger_${randomUUID()}`,
        roomId: room.roomId,
        participantId: payload.participantId,
        seatIndex: payload.seatIndex,
        type: payload.type,
        delta: payload.delta,
        balanceAfter,
        referenceId: payload.referenceId ?? `op_${randomUUID()}`,
        idempotencyKey: payload.idempotencyKey,
        createdAt
      } satisfies LedgerEntryRecord;
    });

    try {
      if (options.onLedgerEntriesCommitted) {
        options.onLedgerEntriesCommitted(entries);
      } else {
        for (const entry of entries) {
          options.onLedgerEntryCommitted?.(entry);
        }
      }

      room.ledgerEntries.push(...entries);
      return entries;
    } catch {
      throw appError({
        code: "ERR_LEDGER_COMMIT_FAILED",
        message: "The room ledger could not be updated.",
        statusCode: 503,
        retryable: true
      });
    }
  }

  function assertBuyInAmountWithinRange(room: RoomRecord, amount: number) {
    const { minChips, maxChips } = getChipRange(room);

    if (amount < minChips) {
      throw appError({
        code: "ERR_MIN_BUYIN",
        message: `Buy-in must be at least ${minChips.toLocaleString()} chips.`,
        statusCode: 422,
        retryable: true
      });
    }

    if (amount > maxChips) {
      throw appError({
        code: "ERR_MAX_BUYIN",
        message: `Buy-in cannot exceed ${maxChips.toLocaleString()} chips.`,
        statusCode: 422,
        retryable: true
      });
    }
  }

  function assertRoomIsBetweenHands(room: RoomRecord) {
    if (room.tablePhase === "HAND_ACTIVE") {
      throw appError({
        code: "ERR_TOPUP_DURING_HAND",
        message: "Top-ups are only allowed between hands.",
        statusCode: 409,
        retryable: true
      });
    }
  }

  function getParticipantSeat(room: RoomRecord, participantId: string) {
    return room.seats.find((seat) => seat.participantId === participantId);
  }

  function getQueuePosition(room: RoomRecord, participantId: string) {
    const index = room.waitingList.findIndex((entry) => entry.participantId === participantId);
    return index >= 0 ? index + 1 : undefined;
  }

  function toSeatSnapshot(room: RoomRecord, seat: SeatRecord) {
    const participant = seat.participantId
      ? room.participants.get(seat.participantId)
      : undefined;

    return {
      seatIndex: seat.seatIndex,
      status: seat.status,
      participantId: seat.participantId,
      nickname: participant?.nickname,
      reservedUntil: seat.reservedUntil ? toIso(seat.reservedUntil) : undefined,
      stack: seat.stack
    };
  }

  function toLobbySnapshot(room: RoomRecord, heroParticipantId?: string) {
    cleanupRoom(room);

    const heroSeat = heroParticipantId
      ? getParticipantSeat(room, heroParticipantId)
      : undefined;
    const canJoinWaitingList =
      Boolean(heroParticipantId) &&
      room.config.waitingListEnabled &&
      room.seats.every((seat) => seat.status !== "EMPTY") &&
      !heroSeat &&
      !room.waitingList.some((entry) => entry.participantId === heroParticipantId);

    return lobbySnapshotSchema.parse({
      room: toRoomSummary(room),
      config: roomConfigSchema.parse(room.config),
      seats: room.seats.map((seat) => toSeatSnapshot(room, seat)),
      waitingList: room.waitingList.map((entry, index) =>
        queueEntrySchema.parse({
          entryId: entry.entryId,
          participantId: entry.participantId,
          nickname: entry.nickname,
          joinedAt: toIso(entry.joinedAt),
          position: index + 1
        })
      ),
      participants: [...room.participants.values()].map((participant) => {
        const seat = getParticipantSeat(room, participant.participantId);
        const queuePosition = getQueuePosition(room, participant.participantId);

        return {
          participantId: participant.participantId,
          nickname: participant.nickname,
          mode: participant.mode,
          state:
            participant.mode === "SPECTATOR"
              ? "SPECTATING"
              : seat?.status === "RESERVED"
                ? "RESERVED"
                : seat?.status === "OCCUPIED"
                  ? "SEATED"
                  : queuePosition
                    ? "QUEUED"
                    : "LOBBY",
          joinedAt: toIso(participant.joinedAt),
          isConnected: participant.isConnected,
          seatIndex: seat?.seatIndex,
          reservationExpiresAt: seat?.reservedUntil ? toIso(seat.reservedUntil) : undefined,
          queuePosition
        };
      }),
      buyInQuote: toBuyInQuote(room),
      heroParticipantId,
      heroSeatIndex: heroSeat?.seatIndex,
      canJoinWaitingList
    });
  }

  function toRealtimeParticipant(room: RoomRecord, participant: ParticipantRecord) {
    const seat = getParticipantSeat(room, participant.participantId);
    const queuePosition = getQueuePosition(room, participant.participantId);

    return {
      participantId: participant.participantId,
      nickname: participant.nickname,
      mode: participant.mode,
      state:
        participant.mode === "SPECTATOR"
          ? "SPECTATING"
          : seat?.status === "RESERVED"
            ? "RESERVED"
            : seat?.status === "OCCUPIED"
              ? "SEATED"
              : queuePosition
                ? "QUEUED"
                : "LOBBY",
      joinedAt: toIso(participant.joinedAt),
      isConnected: participant.isConnected,
      seatIndex: seat?.seatIndex,
      reservationExpiresAt: seat?.reservedUntil ? toIso(seat.reservedUntil) : undefined,
      queuePosition,
      isReady: participant.isReady,
      isSittingOut: participant.isSittingOut,
      lastDisconnectedAt: participant.lastDisconnectedAt
        ? toIso(participant.lastDisconnectedAt)
        : undefined,
      reconnectGraceEndsAt: participant.reconnectGraceEndsAt
        ? toIso(participant.reconnectGraceEndsAt)
        : undefined
    };
  }

  function getCurrentActingSeatIndex(room: RoomRecord) {
    return room.activeHand?.engine.actingSeatIndex;
  }

  function getCurrentHandSeq(room: RoomRecord) {
    return room.activeHand ? getHandSequence(room.activeHand.engine) : undefined;
  }

  function getCurrentActingParticipantId(room: RoomRecord) {
    const actingSeatIndex = getCurrentActingSeatIndex(room);

    if (actingSeatIndex === undefined) {
      return undefined;
    }

    return room.seats.at(actingSeatIndex)?.participantId;
  }

  function getEligibleReadyPlayersForHand(room: RoomRecord) {
    return room.seats
      .filter(
        (seat) =>
          seat.status === "OCCUPIED" &&
          Boolean(seat.participantId) &&
          room.participants.get(seat.participantId ?? "")?.mode === "PLAYER" &&
          room.participants.get(seat.participantId ?? "")?.isReady &&
          !room.participants.get(seat.participantId ?? "")?.isSittingOut &&
          (seat.stack ?? 0) > 0
      )
      .map((seat) => ({
        seatIndex: seat.seatIndex,
        participantId: seat.participantId ?? "",
        stack: seat.stack ?? 0
      }))
      .sort((left, right) => left.seatIndex - right.seatIndex);
  }

  function toActiveHandSnapshot(room: RoomRecord) {
    if (!room.activeHand) {
      return null;
    }

    const engine = room.activeHand.engine;

    return {
      handId: engine.handId,
      handNumber: engine.handNumber,
      handSeq: getHandSequence(engine),
      street: engine.street,
      buttonSeatIndex: engine.buttonSeatIndex,
      smallBlindSeatIndex: engine.smallBlindSeatIndex,
      bigBlindSeatIndex: engine.bigBlindSeatIndex,
      actingSeatIndex: getCurrentActingSeatIndex(room),
      eligibleSeatOrder: engine.seatOrder,
      foldedSeatIndexes: engine.players
        .filter((player) => player.status === "FOLDED")
        .map((player) => player.seatIndex),
      actedSeatIndexes: engine.players
        .filter((player) => player.hasActedThisRound)
        .map((player) => player.seatIndex),
      board: engine.board,
      potTotal: engine.potTotal,
      currentBet: engine.currentBet,
      minimumRaiseTo: engine.minimumRaiseTo,
      showdownSeatIndexes: engine.showdownSeatIndexes,
      showdownRevealOrder: engine.showdownRevealOrder,
      players: engine.players.map((player) => ({
        seatIndex: player.seatIndex,
        participantId: player.participantId,
        status: player.status,
        stack: player.stack,
        streetCommitted: player.streetCommitted,
        totalCommitted: player.totalCommitted,
        hasActed: player.hasActedThisRound,
        canRaise: player.canRaiseThisRound
      })),
      forcedCommitments: engine.forcedCommitments,
      winnerByFoldSeatIndex: engine.winnerByFoldSeatIndex,
      startedAt: toIso(room.activeHand.startedAt),
      deadlineAt: toIso(room.activeHand.deadlineAt)
    };
  }

  function toRoomRealtimeSnapshot(room: RoomRecord, actor: AuthActor): RoomRealtimeSnapshot {
    cleanupRoom(room);

    const heroParticipantId = actor.role === "GUEST" ? actor.guestId : undefined;
    const heroSeat = heroParticipantId
      ? getParticipantSeat(room, heroParticipantId)
      : undefined;
    const canJoinWaitingList =
      Boolean(heroParticipantId) &&
      room.config.waitingListEnabled &&
      room.seats.every((seat) => seat.status !== "EMPTY") &&
      !heroSeat &&
      !room.waitingList.some((entry) => entry.participantId === heroParticipantId);

    return roomRealtimeSnapshotSchema.parse({
      room: toRoomSummary(room),
      config: roomConfigSchema.parse(room.config),
      seats: room.seats.map((seat) => toSeatSnapshot(room, seat)),
      waitingList: room.waitingList.map((entry, index) => ({
        entryId: entry.entryId,
        participantId: entry.participantId,
        nickname: entry.nickname,
        joinedAt: toIso(entry.joinedAt),
        position: index + 1
      })),
      participants: [...room.participants.values()].map((participant) =>
        toRealtimeParticipant(room, participant)
      ),
      buyInQuote: toBuyInQuote(room),
      heroParticipantId,
      heroSeatIndex: heroSeat?.seatIndex,
      canJoinWaitingList,
      tablePhase: room.tablePhase,
      roomEventNo: room.roomEventNo,
      activeHand: toActiveHandSnapshot(room),
      pausedReason: room.pausedReason ?? null
    });
  }

  function getActionAffordances(room: RoomRecord, participantId: string) {
    const seat = getParticipantSeat(room, participantId);

    if (
      !room.activeHand ||
      room.status !== "OPEN" ||
      seat?.seatIndex === undefined
    ) {
      return undefined;
    }

    const legalActions = getHoldemLegalActions(room.activeHand.engine, seat.seatIndex);

    return legalActions ? roomActionAffordancesSchema.parse(legalActions) : undefined;
  }

  function toRoomPrivateState(
    room: RoomRecord,
    actor: Extract<AuthActor, { role: "GUEST" }>
  ): RoomPrivateState {
    cleanupRoom(room);

    const participant = room.participants.get(actor.guestId);
    const seat = getParticipantSeat(room, actor.guestId);

    return roomPrivateStateSchema.parse({
      roomId: room.roomId,
      participantId: actor.guestId,
      roomEventNo: room.roomEventNo,
      seatIndex: seat?.seatIndex,
      stack: seat?.stack,
      holeCards:
        room.activeHand && seat?.seatIndex !== undefined
          ? getPlayerHoleCards(room.activeHand.engine, seat.seatIndex)
          : undefined,
      actionAffordances: getActionAffordances(room, actor.guestId),
      reconnect: {
        isReconnecting: Boolean(
          participant?.lastDisconnectedAt && participant.reconnectGraceEndsAt
        ),
        disconnectedAt: participant?.lastDisconnectedAt
          ? toIso(participant.lastDisconnectedAt)
          : undefined,
        reconnectGraceEndsAt: participant?.reconnectGraceEndsAt
          ? toIso(participant.reconnectGraceEndsAt)
          : undefined
      }
    });
  }

  function buildRoomDiff(
    room: RoomRecord,
    actor: AuthActor,
    changed: RoomPatchField[]
  ): RoomDiffPatch {
    const snapshot = toRoomRealtimeSnapshot(room, actor);
    const patch: RoomDiffPatch = {};

    for (const field of changed) {
      if (field === "room") {
        patch.room = snapshot.room;
        continue;
      }

      if (field === "seats") {
        patch.seats = snapshot.seats;
        continue;
      }

      if (field === "participants") {
        patch.participants = snapshot.participants;
        continue;
      }

      if (field === "waitingList") {
        patch.waitingList = snapshot.waitingList;
        continue;
      }

      if (field === "buyInQuote") {
        patch.buyInQuote = snapshot.buyInQuote;
        continue;
      }

      if (field === "tablePhase") {
        patch.tablePhase = snapshot.tablePhase;
        continue;
      }

      if (field === "activeHand") {
        patch.activeHand = snapshot.activeHand ?? null;
        continue;
      }

      if (field === "pausedReason") {
        patch.pausedReason = snapshot.pausedReason ?? null;
      }
    }

    return roomDiffPatchSchema.parse(patch);
  }

  function emitRoomRefresh(
    room: RoomRecord,
    changed: RoomPatchField[],
    options: { roomEventNo?: number; handId?: string; handSeq?: number } = {}
  ) {
    const roomEventNo = options.roomEventNo ?? nextRoomEventNo(room);

    emitRoomEvent(room.roomId, {
      type: "ROOM_DIFF",
      roomId: room.roomId,
      roomEventNo,
      changed,
      handId: options.handId,
      handSeq: options.handSeq
    });

    return roomEventNo;
  }

  function getCachedActionIntent(
    room: RoomRecord,
    participantId: string,
    idempotencyKey: string | undefined,
    fingerprint: string
  ) {
    if (!idempotencyKey) {
      return null;
    }

    const cacheKey = `${participantId}:${idempotencyKey}`;
    const cached = room.processedActionIntents.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.fingerprint !== fingerprint) {
      throw appError({
        code: "ERR_ACTION_INVALID",
        message: "That idempotency key was already used for a different hand action.",
        statusCode: 409,
        retryable: false
      });
    }

    return cached.result;
  }

  function storeActionIntent(
    room: RoomRecord,
    participantId: string,
    idempotencyKey: string | undefined,
    fingerprint: string,
    result: CachedActionIntent["result"]
  ) {
    if (!idempotencyKey) {
      return;
    }

    room.processedActionIntents.set(`${participantId}:${idempotencyKey}`, {
      fingerprint,
      result
    });
  }

  function clearReadyStateAfterHand(room: RoomRecord) {
    for (const participant of room.participants.values()) {
      if (participant.mode === "PLAYER") {
        participant.isReady = false;
      }
    }
  }

  function syncSeatStacksFromActiveHand(room: RoomRecord) {
    if (!room.activeHand) {
      return;
    }

    for (const player of room.activeHand.engine.players) {
      const seat = room.seats.at(player.seatIndex);

      if (seat?.participantId === player.participantId) {
        seat.stack = player.stack;
      }
    }
  }

  function createRakeParticipantId(roomId: string) {
    return `house_rake:${roomId}`;
  }

  function buildDeckReveal(engine: HoldemHandState) {
    const orderedPlayers = engine.seatOrder
      .map((seatIndex) => engine.players.find((player) => player.seatIndex === seatIndex))
      .filter((player): player is HoldemHandState["players"][number] => Boolean(player));

    return [
      ...orderedPlayers.map((player) => player.holeCards[0]),
      ...orderedPlayers.map((player) => player.holeCards[1]),
      ...engine.board,
      ...engine.deck
    ];
  }

  function buildDeckCommitmentHash(engine: HoldemHandState) {
    return createHash("sha256").update(buildDeckReveal(engine).join("|")).digest("hex");
  }

  function getAuditEventsForHand(handId: string) {
    return auditEvents.filter((event) => event.handId === handId);
  }

  function toHandHistorySummary(transcript: HandTranscript) {
    return handHistorySummarySchema.parse({
      handId: transcript.handId,
      roomId: transcript.roomId,
      handNumber: transcript.handNumber,
      startedAt: transcript.startedAt,
      endedAt: transcript.endedAt,
      playerCount: transcript.contributions.length,
      totalPot: transcript.settlement.totalPot,
      totalRake: transcript.settlement.totalRake,
      board: transcript.board
    });
  }

  function storeHandHistory(room: RoomRecord, transcript: HandTranscript) {
    handHistories.set(transcript.handId, {
      transcript,
      endedAt: new Date(transcript.endedAt)
    });
    room.handHistoryIds.push(transcript.handId);
  }

  function assertActorCanAccessRoomHistory(room: RoomRecord, actor: AuthActor) {
    if (actor.role === "ADMIN") {
      if (room.adminId !== actor.adminId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This admin cannot access that room history.",
          statusCode: 403,
          retryable: false
        });
      }

      return;
    }

    if (actor.roomId !== room.roomId) {
      throw appError({
        code: "ERR_FORBIDDEN",
        message: "This guest session is scoped to a different room.",
        statusCode: 403,
        retryable: false
      });
    }
  }

  function buildHandTranscript(
    room: RoomRecord,
    hand: ActiveHandRecord,
    settlement: HandSettlement,
    ledgerEntries: LedgerEntry[],
    endedAt: Date
  ) {
    return handTranscriptSchema.parse({
      roomId: room.roomId,
      handId: hand.engine.handId,
      handNumber: hand.engine.handNumber,
      buttonSeatIndex: hand.engine.buttonSeatIndex,
      smallBlindSeatIndex: hand.engine.smallBlindSeatIndex,
      bigBlindSeatIndex: hand.engine.bigBlindSeatIndex,
      startedAt: toIso(hand.startedAt),
      endedAt: toIso(endedAt),
      board: [...hand.engine.board],
      deckCommitmentHash: buildDeckCommitmentHash(hand.engine),
      deckReveal: buildDeckReveal(hand.engine),
      actions: hand.engine.actionLog.map((action) => ({
        seq: action.seq,
        seatIndex: action.seatIndex,
        participantId: action.participantId,
        street: action.street,
        actionType: action.actionType,
        normalizedAmount: action.normalizedAmount,
        contributedAmount: action.contributedAmount,
        totalCommitted: action.totalCommitted,
        streetCommitted: action.streetCommitted
      })),
      forcedCommitments: hand.engine.forcedCommitments.map((commitment) => ({
        seatIndex: commitment.seatIndex,
        participantId: commitment.participantId,
        type: commitment.type,
        amount: commitment.amount
      })),
      contributions: hand.engine.players.map((player) => ({
        seatIndex: player.seatIndex,
        participantId: player.participantId,
        totalCommitted: player.totalCommitted,
        contributedByStreet: player.contributedByStreet
      })),
      settlement,
      ledgerEntries,
      auditEvents: getAuditEventsForHand(hand.engine.handId).map((event) => ({
        eventId: event.eventId,
        type: event.type,
        occurredAt: event.occurredAt,
        actorId: event.actorId,
        detail: event.detail
      }))
    });
  }

  function buildPreflopActionSeatOrder(engine: HoldemHandState) {
    const actingSeatIndex = engine.actingSeatIndex;

    if (actingSeatIndex === undefined) {
      return [...engine.seatOrder];
    }

    const actingSeatOrderIndex = engine.seatOrder.indexOf(actingSeatIndex);

    if (actingSeatOrderIndex < 0) {
      return [...engine.seatOrder];
    }

    return [
      ...engine.seatOrder.slice(actingSeatOrderIndex),
      ...engine.seatOrder.slice(0, actingSeatOrderIndex)
    ];
  }

  function settleAndFinalizeActiveHand(room: RoomRecord) {
    const hand = room.activeHand;

    if (!hand) {
      return;
    }

    clearTurnTimers(room.roomId);

    try {
      const settlement = handSettlementSchema.parse(
        settleHoldemHand(
          {
            handId: hand.engine.handId,
            handNumber: hand.engine.handNumber,
            buttonSeatIndex: hand.engine.buttonSeatIndex,
            smallBlindSeatIndex: hand.engine.smallBlindSeatIndex,
            bigBlindSeatIndex: hand.engine.bigBlindSeatIndex,
            potTotal: hand.engine.potTotal,
            board: [...hand.engine.board],
            seatOrder: [...hand.engine.seatOrder],
            players: hand.engine.players.map((player) => ({
              seatIndex: player.seatIndex,
              participantId: player.participantId,
              startingStack: player.startingStack,
              stack: player.stack,
              status: player.status,
              holeCards: player.holeCards,
              totalCommitted: player.totalCommitted,
              contributedByStreet: player.contributedByStreet
            })),
            actionLog: hand.engine.actionLog.map((action) => ({
              seq: action.seq,
              seatIndex: action.seatIndex,
              participantId: action.participantId,
              street: action.street,
              actionType: action.actionType,
              normalizedAmount: action.normalizedAmount,
              contributedAmount: action.contributedAmount,
              totalCommitted: action.totalCommitted,
              streetCommitted: action.streetCommitted
            })),
            forcedCommitments: hand.engine.forcedCommitments.map((commitment) => ({
              seatIndex: commitment.seatIndex,
              participantId: commitment.participantId,
              type: commitment.type,
              amount: commitment.amount
            })),
            winnerByFoldSeatIndex: hand.engine.winnerByFoldSeatIndex
          },
          {
            oddChipRule: room.config.oddChipRule,
            rakeConfig: {
              enabled: room.config.rakeEnabled,
              percent: room.config.rakePercent,
              cap: room.config.rakeCap,
              mode: "PER_HAND"
            }
          }
        )
      );
      const settlementReferenceId = `settlement_${hand.engine.handId}`;
      const committedLedgerEntries = commitLedgerEntries(room, [
        ...settlement.playerResults
          .filter((playerResult) => playerResult.won > 0)
          .map((playerResult) => ({
            participantId: playerResult.participantId,
            seatIndex: playerResult.seatIndex,
            type: "HAND_PAYOUT" as const,
            delta: playerResult.won,
            referenceId: settlementReferenceId
          })),
        ...(settlement.totalRake > 0
          ? [
              {
                participantId: createRakeParticipantId(room.roomId),
                type: "RAKE" as const,
                delta: settlement.totalRake,
                referenceId: settlementReferenceId
              }
            ]
          : [])
      ]).map((entry) => toLedgerEntry(entry));
      const endedAt = clock();

      for (const playerResult of settlement.playerResults) {
        const seat = room.seats.at(playerResult.seatIndex);

        if (seat?.participantId === playerResult.participantId) {
          seat.stack = playerResult.finalStack;
        }
      }

      room.lastButtonSeatIndex = hand.engine.buttonSeatIndex;
      room.tablePhase = "BETWEEN_HANDS";
      room.activeHand = undefined;
      room.pausedTurnRemainingMs = undefined;
      clearReadyStateAfterHand(room);

      addAuditEvent({
        type: "HAND_SETTLED",
        roomId: room.roomId,
        handId: hand.engine.handId,
        detail: `Hand ${hand.engine.handNumber} settled with ${settlement.totalPot.toLocaleString()} chips`,
        actorId: room.adminId
      });

      const transcript = buildHandTranscript(
        room,
        hand,
        settlement,
        committedLedgerEntries,
        endedAt
      );
      storeHandHistory(room, transcript);

      const roomEventNo = emitRoomRefresh(room, ["participants", "seats", "tablePhase", "activeHand"], {
        handId: hand.engine.handId,
        handSeq: getHandSequence(hand.engine)
      });

      emitRoomEvent(room.roomId, {
        type: "SHOWDOWN_RESULT",
        roomId: room.roomId,
        roomEventNo,
        handId: hand.engine.handId,
        handSeq: getHandSequence(hand.engine),
        awardedByFold: settlement.awardedByFold,
        results: settlement.showdownResults,
        pots: settlement.pots
      });

      emitRoomEvent(room.roomId, {
        type: "SETTLEMENT_POSTED",
        roomId: room.roomId,
        roomEventNo,
        handId: hand.engine.handId,
        handSeq: getHandSequence(hand.engine),
        settlement,
        ledgerEntries: committedLedgerEntries
      });
    } catch {
      pauseRoomInternal(
        room,
        "Settlement could not be committed, so the room is paused before any payouts become visible.",
        "Review the active hand state and resume after the settlement fault is resolved."
      );
    }
  }

  function scheduleReservationExpiry(room: RoomRecord, seat: SeatRecord) {
    if (!seat.reservedUntil) {
      return;
    }

    clearReservationTimer(room.roomId, seat.seatIndex);
    const runtime = getOrCreateRoomRuntime(room.roomId);
    const reservationToken = seat.reservationToken ?? randomUUID();
    seat.reservationToken = reservationToken;

    runtime.reservationTimers.set(
      seat.seatIndex,
      setTimeout(() => {
        const currentRoom = roomsById.get(room.roomId);
        const currentSeat = currentRoom?.seats.at(seat.seatIndex);

        if (
          !currentRoom ||
          !currentSeat ||
          currentSeat.status !== "RESERVED" ||
          currentSeat.reservationToken !== reservationToken
        ) {
          return;
        }

        currentSeat.status = "EMPTY";
        currentSeat.participantId = undefined;
        currentSeat.reservedUntil = undefined;
        currentSeat.reservationToken = undefined;
        clearReservationTimer(currentRoom.roomId, currentSeat.seatIndex);

        emitRoomRefresh(currentRoom, ["room", "seats", "participants"]);
      }, Math.max(0, seat.reservedUntil.getTime() - clock().getTime()))
    );
  }

  function scheduleTurnTimers(room: RoomRecord) {
    if (
      !room.activeHand ||
      room.activeHand.engine.handStatus !== "BETTING" ||
      room.activeHand.engine.actingSeatIndex === undefined
    ) {
      return;
    }

    clearTurnTimers(room.roomId);
    const runtime = getOrCreateRoomRuntime(room.roomId);
    const timerToken = room.activeHand.timerToken;

    runtime.turnWarningTimer = setTimeout(() => {
      const currentRoom = roomsById.get(room.roomId);

      if (
        !currentRoom?.activeHand ||
        currentRoom.activeHand.timerToken !== timerToken ||
        currentRoom.status !== "OPEN" ||
        currentRoom.activeHand.engine.handStatus !== "BETTING"
      ) {
        return;
      }

      const actingSeatIndex = getCurrentActingSeatIndex(currentRoom);

      if (actingSeatIndex === undefined) {
        return;
      }

      emitRoomEvent(currentRoom.roomId, {
        type: "TURN_WARNING",
        roomId: currentRoom.roomId,
        roomEventNo: nextRoomEventNo(currentRoom),
        handId: currentRoom.activeHand.engine.handId,
        handSeq: getHandSequence(currentRoom.activeHand.engine),
        actingSeatIndex,
        secondsRemaining: Math.ceil(TURN_WARNING_MS / 1000)
      });
    }, Math.max(0, room.activeHand.deadlineAt.getTime() - clock().getTime() - TURN_WARNING_MS));

    runtime.turnExpiryTimer = setTimeout(() => {
      const currentRoom = roomsById.get(room.roomId);

      if (
        !currentRoom?.activeHand ||
        currentRoom.activeHand.timerToken !== timerToken ||
        currentRoom.status !== "OPEN" ||
        currentRoom.activeHand.engine.handStatus !== "BETTING"
      ) {
        return;
      }

      const actingSeatIndex = getCurrentActingSeatIndex(currentRoom);
      const participantId =
        actingSeatIndex === undefined
          ? undefined
          : currentRoom.seats.at(actingSeatIndex)?.participantId;

      if (!participantId) {
        return;
      }

      const legalActions = getActionAffordances(currentRoom, participantId);
      const timeoutActionType = legalActions?.canCheck ? "CHECK" : "TIMEOUT_FOLD";

      void applyPlayerAction(currentRoom, participantId, {
        handId: currentRoom.activeHand.engine.handId,
        seqExpectation: getHandSequence(currentRoom.activeHand.engine),
        idempotencyKey: `timeout-${currentRoom.activeHand.engine.handId}-${getHandSequence(
          currentRoom.activeHand.engine
        )}`,
        actionType: timeoutActionType
      });
    }, Math.max(0, room.activeHand.deadlineAt.getTime() - clock().getTime()));
  }

  function startTurn(room: RoomRecord, roomEventNo?: number) {
    if (
      !room.activeHand ||
      room.activeHand.engine.handStatus !== "BETTING" ||
      room.activeHand.engine.actingSeatIndex === undefined
    ) {
      return;
    }

    room.activeHand.deadlineAt = new Date(
      clock().getTime() + (room.pausedTurnRemainingMs ?? TURN_DURATION_MS)
    );
    room.activeHand.timerToken = randomUUID();
    room.pausedTurnRemainingMs = undefined;

    const actingSeatIndex = getCurrentActingSeatIndex(room);

    if (actingSeatIndex === undefined) {
      return;
    }

    const participantId = getCurrentActingParticipantId(room);
    const legalActions =
      participantId && getActionAffordances(room, participantId);
    const eventNo = roomEventNo ?? nextRoomEventNo(room);

    if (legalActions) {
      emitRoomEvent(room.roomId, {
        type: "TURN_STARTED",
        roomId: room.roomId,
        roomEventNo: eventNo,
        handId: room.activeHand.engine.handId,
        handSeq: getHandSequence(room.activeHand.engine),
        actingSeatIndex,
        deadlineAt: toIso(room.activeHand.deadlineAt),
        legalActions
      });
    }

    scheduleTurnTimers(room);
  }

  function startHoldemHandIfReady(room: RoomRecord) {
    if (room.status !== "OPEN" || room.tablePhase !== "BETWEEN_HANDS" || room.activeHand) {
      return;
    }

    const eligiblePlayers = getEligibleReadyPlayersForHand(room);

    if (eligiblePlayers.length < 2) {
      return;
    }

    const engine = startHoldemHand({
      handId: `hand_${randomUUID()}`,
      handNumber: room.roomEventNo + 1,
      previousButtonSeatIndex: room.lastButtonSeatIndex,
      smallBlind: room.config.smallBlind,
      bigBlind: room.config.bigBlind,
      ante: room.config.ante,
      players: eligiblePlayers
    });

    room.tablePhase = "HAND_ACTIVE";
    room.activeHand = {
      engine,
      startedAt: clock(),
      deadlineAt: clock(),
      timerToken: randomUUID()
    };
    room.lastButtonSeatIndex = engine.buttonSeatIndex;
    syncSeatStacksFromActiveHand(room);

    const roomEventNo = emitRoomRefresh(room, [
      "participants",
      "seats",
      "tablePhase",
      "activeHand"
    ]);

    emitRoomEvent(room.roomId, {
      type: "HAND_STARTED",
      roomId: room.roomId,
      roomEventNo,
      handId: engine.handId,
      handSeq: getHandSequence(engine),
      handNumber: engine.handNumber,
      actionSeatOrder: buildPreflopActionSeatOrder(engine),
      blindSeatIndexes: [engine.smallBlindSeatIndex, engine.bigBlindSeatIndex].filter(
        (seatIndex): seatIndex is number => seatIndex !== undefined
      ),
      buttonSeatIndex: engine.buttonSeatIndex
    });

    addAuditEvent({
      type: "HAND_STARTED",
      roomId: room.roomId,
      handId: engine.handId,
      actorId: room.adminId,
      detail: `Hand ${engine.handNumber} started`
    });

    startTurn(room, roomEventNo);
  }

  function pauseRoomInternal(room: RoomRecord, reason: string, recoveryGuidance?: string) {
    if (room.status === "PAUSED") {
      return;
    }

    room.status = "PAUSED";
    room.pausedReason = reason;

    if (room.activeHand) {
      room.pausedTurnRemainingMs = Math.max(
        0,
        room.activeHand.deadlineAt.getTime() - clock().getTime()
      );
    }

    clearTurnTimers(room.roomId);
    const roomEventNo = emitRoomRefresh(room, ["room", "pausedReason", "activeHand"]);

    emitRoomEvent(room.roomId, {
      type: "ROOM_PAUSED",
      roomId: room.roomId,
      roomEventNo,
      reason,
      recoveryGuidance
    });
  }

  function resumeRoomInternal(room: RoomRecord) {
    if (room.status !== "PAUSED") {
      return;
    }

    room.status = "OPEN";
    room.pausedReason = undefined;
    const roomEventNo = emitRoomRefresh(room, ["room", "pausedReason"]);

    if (room.activeHand) {
      startTurn(room, roomEventNo);
      return;
    }

    startHoldemHandIfReady(room);
  }

  async function applyPlayerAction(
    room: RoomRecord,
    participantId: string,
    payload: {
      handId: string;
      seqExpectation: number;
      idempotencyKey?: string;
      actionType: "CHECK" | "FOLD" | "CALL" | "BET" | "RAISE" | "ALL_IN" | "TIMEOUT_FOLD";
      amount?: number;
    },
    options: { emitAcceptedEvent?: boolean } = {}
  ) {
    const fingerprint = JSON.stringify(payload);
    const cached = getCachedActionIntent(room, participantId, payload.idempotencyKey, fingerprint);

    if (cached) {
      return cached;
    }

    const reject = (options: {
      errorCode: ErrorCode;
      message: string;
      expectedSeq?: number;
    }) => {
      const result: CachedActionIntent["result"] = {
        outcome: "rejected",
        roomEventNo: nextRoomEventNo(room),
        handId: room.activeHand?.engine.handId,
        handSeq: getCurrentHandSeq(room),
        idempotencyKey: payload.idempotencyKey,
        errorCode: options.errorCode,
        message: options.message,
        expectedSeq: options.expectedSeq
      };

      storeActionIntent(room, participantId, payload.idempotencyKey, fingerprint, result);
      return result;
    };

    if (room.status === "PAUSED") {
      return reject({
        errorCode: "ERR_ROOM_PAUSED",
        message: "The room is paused and cannot accept hand actions right now."
      });
    }

    if (!room.activeHand) {
      return reject({
        errorCode: "ERR_ACTION_INVALID",
        message: "There is no active hand to act in."
      });
    }

    if (room.activeHand.engine.handId !== payload.handId) {
      return reject({
        errorCode: "ERR_STALE_SEQUENCE",
        message: "That hand is no longer active.",
        expectedSeq: getHandSequence(room.activeHand.engine)
      });
    }

    if (getHandSequence(room.activeHand.engine) !== payload.seqExpectation) {
      return reject({
        errorCode: "ERR_STALE_SEQUENCE",
        message: "The expected hand sequence no longer matches the authoritative room state.",
        expectedSeq: getHandSequence(room.activeHand.engine)
      });
    }

    const seat = getParticipantSeat(room, participantId);
    const actingSeatIndex = getCurrentActingSeatIndex(room);

    if (!seat || actingSeatIndex !== seat.seatIndex) {
      return reject({
        errorCode: "ERR_NOT_YOUR_TURN",
        message: "It is not your turn to act."
      });
    }

    clearTurnTimers(room.roomId);
    let transition;

    try {
      transition = applyHoldemEngineAction(room.activeHand.engine, {
        seatIndex: seat.seatIndex,
        actionType: payload.actionType,
        amount: payload.amount
      });
    } catch (error) {
      if (error instanceof HoldemEngineError) {
        return reject({
          errorCode: error.code,
          message: error.message
        });
      }

      throw error;
    }

    room.activeHand.engine = transition.state;
    syncSeatStacksFromActiveHand(room);

    const handSeq = getHandSequence(transition.state);
    const roomEventNo = nextRoomEventNo(room);
    const result: CachedActionIntent["result"] = {
      outcome: "accepted",
      roomEventNo,
      handId: transition.state.handId,
      handSeq,
      participantId,
      seatIndex: seat.seatIndex,
      idempotencyKey:
        payload.idempotencyKey ?? `timeout-${transition.state.handId}-${handSeq}`,
      actionType: transition.normalizedAction.actionType,
      normalizedAmount: transition.normalizedAction.normalizedAmount
    };

    storeActionIntent(room, participantId, payload.idempotencyKey, fingerprint, result);

    if (options.emitAcceptedEvent ?? true) {
      emitRoomEvent(room.roomId, {
        type: "ACTION_ACCEPTED",
        roomId: room.roomId,
        roomEventNo,
        handId: transition.state.handId,
        handSeq,
        participantId,
        seatIndex: seat.seatIndex,
        idempotencyKey: result.idempotencyKey,
        actionType: transition.normalizedAction.actionType,
        normalizedAmount: transition.normalizedAction.normalizedAmount
      });
    }

    addAuditEvent({
      type: "ACTION_COMMITTED",
      roomId: room.roomId,
      handId: transition.state.handId,
      actorId: participantId,
      detail: `${transition.normalizedAction.actionType} committed from seat ${
        seat.seatIndex + 1
      } at hand seq ${handSeq}`
    });

    if (
      transition.normalizedAction.actionType === "TIMEOUT_FOLD" ||
      payload.idempotencyKey?.startsWith("timeout-")
    ) {
      addAuditEvent({
        type: "TURN_TIMED_OUT",
        roomId: room.roomId,
        handId: transition.state.handId,
        actorId: participantId,
        detail: `Seat ${seat.seatIndex + 1} timed out and auto-folded`
      });
    }

    const awardedEffect = transition.effects.find((effect) => effect.type === "HAND_AWARDED");

    if (awardedEffect) {
      settleAndFinalizeActiveHand(room);
      return result;
    }

    emitRoomRefresh(room, ["activeHand", "seats"], {
      roomEventNo,
      handId: transition.state.handId,
      handSeq
    });

    for (const effect of transition.effects) {
      if (effect.type === "STREET_ADVANCED") {
        if (effect.street === "PREFLOP") {
          continue;
        }

        emitRoomEvent(room.roomId, {
          type: "STREET_ADVANCED",
          roomId: room.roomId,
          roomEventNo,
          handId: transition.state.handId,
          handSeq,
          street: effect.street,
          board: effect.board,
          revealedCards: effect.revealedCards
        });
        continue;
      }

      if (effect.type === "SHOWDOWN_TRIGGERED") {
        emitRoomEvent(room.roomId, {
          type: "SHOWDOWN_TRIGGERED",
          roomId: room.roomId,
          roomEventNo,
          handId: transition.state.handId,
          handSeq,
          board: effect.board,
          eligibleSeatIndexes: effect.eligibleSeatIndexes,
          revealOrder: effect.revealOrder
        });
      }
    }

    if (room.activeHand?.engine.handStatus === "SHOWDOWN_PENDING") {
      settleAndFinalizeActiveHand(room);
      return result;
    }

    if (
      room.activeHand &&
      room.activeHand.engine.handStatus === "BETTING" &&
      room.activeHand.engine.actingSeatIndex !== undefined
    ) {
      startTurn(room, roomEventNo);
    }

    return result;
  }

  return {
    accessMaxAgeSeconds: Math.floor(ACCESS_TTL_MS / 1000),
    refreshMaxAgeSeconds: Math.floor(REFRESH_TTL_MS / 1000),
    async requestAdminOtp(options: RequestOtpOptions) {
      const now = clock();
      const email = normalizeEmail(options.email);

      consumeRateLimit(`otp-email:${email}`, OTP_REQUEST_LIMIT, OTP_REQUEST_WINDOW_MS);
      consumeRateLimit(`otp-ip:${options.ip}`, OTP_REQUEST_LIMIT, OTP_REQUEST_WINDOW_MS);

      const previousChallengeId = otpChallengeByEmail.get(email);
      const previousChallenge =
        previousChallengeId ? otpChallenges.get(previousChallengeId) : undefined;

      if (
        previousChallenge &&
        !previousChallenge.usedAt &&
        previousChallenge.expiresAt.getTime() > now.getTime()
      ) {
        const cooldownEndsAt = new Date(
          previousChallenge.lastSentAt.getTime() + OTP_COOLDOWN_MS
        );

        if (cooldownEndsAt.getTime() > now.getTime()) {
          throw appError({
            code: "ERR_RATE_LIMITED",
            message: "Please wait before requesting another code.",
            statusCode: 429,
            retryable: true,
            details: {
              retryAfterSeconds: String(secondsBetween(now, cooldownEndsAt))
            }
          });
        }
      }

      const challengeId = `challenge_${randomUUID()}`;
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

      otpChallenges.set(challengeId, {
        challengeId,
        email,
        code,
        expiresAt,
        lastSentAt: now,
        verifyAttempts: 0
      });
      otpChallengeByEmail.set(email, challengeId);

      await options.emailAdapter.sendAdminOtp({
        email,
        code,
        challengeId,
        expiresAt: toIso(expiresAt)
      });

      addAuditEvent({ type: "AUTH_ADMIN_OTP_REQUESTED", detail: `OTP requested for ${email}` });

      return adminOtpRequestResponseSchema.parse({
        challengeId,
        cooldownSeconds: Math.floor(OTP_COOLDOWN_MS / 1000),
        expiresAt: toIso(expiresAt),
        delivery: { channel: "email", recipientHint: maskEmail(email) }
      });
    },
    verifyAdminOtp(challengeId: string, code: string, ip: string, env: TokenEnv) {
      consumeRateLimit(`verify-ip:${ip}`, OTP_VERIFY_LIMIT, OTP_REQUEST_WINDOW_MS);

      const challenge = otpChallenges.get(challengeId);
      const now = clock();

      if (!challenge || challenge.usedAt || challenge.expiresAt.getTime() <= now.getTime()) {
        throw appError({
          code: "ERR_OTP_EXPIRED",
          message: "That verification code has expired.",
          statusCode: 401,
          retryable: true
        });
      }

      if (challenge.verifyAttempts >= OTP_VERIFY_LIMIT) {
        throw appError({
          code: "ERR_RATE_LIMITED",
          message: "Too many incorrect attempts for this code.",
          statusCode: 429,
          retryable: true
        });
      }

      if (challenge.code !== code) {
        challenge.verifyAttempts += 1;
        addAuditEvent({
          type: "AUTH_ADMIN_OTP_REJECTED",
          detail: `Incorrect code for ${challenge.email}`
        });

        throw appError({
          code: "ERR_OTP_INVALID",
          message: "The verification code is incorrect.",
          statusCode: 401,
          retryable: true
        });
      }

      challenge.usedAt = now;

      const adminProfile = getOrCreateAdminProfile(challenge.email);
      const issuedSession = createSession(
        { role: "ADMIN", adminId: adminProfile.adminId, email: adminProfile.email },
        env
      );

      addAuditEvent({
        type: "AUTH_ADMIN_VERIFIED",
        actorId: adminProfile.adminId,
        detail: `Admin session created for ${adminProfile.email}`
      });

      return issuedSession;
    },
    createRoom(actor: Extract<AuthActor, { role: "ADMIN" }>, input: RoomConfig) {
      const config = roomConfigSchema.parse(input);

      for (const room of roomsById.values()) {
        cleanupRoom(room);

        if (room.adminId === actor.adminId && room.status !== "CLOSED") {
          throw appError({
            code: "ERR_ACTIVE_ROOM_EXISTS",
            message: "This admin already has an active room.",
            statusCode: 409,
            retryable: false
          });
        }
      }

      const now = clock();
      const room: RoomRecord = {
        roomId: `room_${randomUUID()}`,
        code: generateUniqueRoomCode(),
        status: "OPEN",
        tablePhase: "BETWEEN_HANDS",
        adminId: actor.adminId,
        config,
        createdAt: now,
        joinCodeExpiresAt: new Date(now.getTime() + config.joinCodeExpiryMinutes * 60 * 1000),
        closesAt: new Date(now.getTime() + config.roomMaxDurationMinutes * 60 * 1000),
        participants: new Map(),
        waitingList: [],
        seats: createSeatMap(config.maxSeats),
        ledgerEntries: [],
        processedLedgerOperations: new Map(),
        processedActionIntents: new Map(),
        roomEventNo: 0,
        handHistoryIds: []
      };

      roomsByCode.set(room.code, room);
      roomsById.set(room.roomId, room);
      getOrCreateRoomRuntime(room.roomId);

      addAuditEvent({
        type: "ROOM_CREATED",
        roomId: room.roomId,
        actorId: actor.adminId,
        detail: `Room ${room.code} created`
      });

      return roomCreateResponseSchema.parse({
        room: toRoomSummary(room),
        lobbySnapshot: toLobbySnapshot(room)
      });
    },
    getRoomSummary(code: string) {
      return toRoomSummary(getRoomRecordByCode(code));
    },
    getLobbySnapshot(roomId: string, actor: AuthActor) {
      const room = getRoomRecordById(roomId);

      if (actor.role === "ADMIN") {
        if (room.adminId !== actor.adminId) {
          throw appError({
            code: "ERR_FORBIDDEN",
            message: "This admin cannot view that room.",
            statusCode: 403,
            retryable: false
          });
        }

        return toLobbySnapshot(room);
      }

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      return toLobbySnapshot(room, actor.guestId);
    },
    getRoomRealtimeSnapshot(roomId: string, actor: AuthActor) {
      const room = getRoomRecordById(roomId);

      if (actor.role === "ADMIN") {
        if (room.adminId !== actor.adminId) {
          throw appError({
            code: "ERR_FORBIDDEN",
            message: "This admin cannot subscribe to that room.",
            statusCode: 403,
            retryable: false
          });
        }

        return toRoomRealtimeSnapshot(room, actor);
      }

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      return toRoomRealtimeSnapshot(room, actor);
    },
    getRoomPrivateState(roomId: string, actor: AuthActor) {
      if (actor.role !== "GUEST") {
        return null;
      }

      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      return toRoomPrivateState(room, actor);
    },
    listRoomHands(roomId: string, actor: AuthActor, cursor?: string, limit = 20) {
      const room = getRoomRecordById(roomId);
      assertActorCanAccessRoomHistory(room, actor);

      const summaries = [...room.handHistoryIds]
        .reverse()
        .map((handId) => handHistories.get(handId)?.transcript)
        .filter((transcript): transcript is HandTranscript => Boolean(transcript))
        .map((transcript) => toHandHistorySummary(transcript));
      const normalizedLimit = Math.max(1, Math.min(limit, 50));
      const startIndex =
        cursor && summaries.some((summary) => summary.handId === cursor)
          ? summaries.findIndex((summary) => summary.handId === cursor) + 1
          : 0;
      const items = summaries.slice(startIndex, startIndex + normalizedLimit);
      const nextCursor =
        summaries.length > startIndex + normalizedLimit
          ? items.at(-1)?.handId ?? null
          : null;

      return handHistoryListResponseSchema.parse({
        items,
        nextCursor
      });
    },
    getHandTranscript(handId: string, actor: AuthActor) {
      const record = handHistories.get(handId);

      if (!record) {
        throw appError({
          code: "ERR_ROOM_NOT_FOUND",
          message: "That hand history does not exist.",
          statusCode: 404,
          retryable: false
        });
      }

      const room = getRoomRecordById(record.transcript.roomId);
      assertActorCanAccessRoomHistory(room, actor);
      return handTranscriptSchema.parse(record.transcript);
    },
    buildRoomRealtimeDiff(roomId: string, actor: AuthActor, changed: RoomPatchField[]) {
      const room = getRoomRecordById(roomId);

      if (actor.role === "ADMIN" && room.adminId !== actor.adminId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This admin cannot subscribe to that room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.role === "GUEST" && actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      return buildRoomDiff(room, actor, changed);
    },
    subscribeToRoomEvents(roomId: string, listener: RoomEventListener) {
      getRoomRecordById(roomId);
      const runtime = getOrCreateRoomRuntime(roomId);
      runtime.subscribers.add(listener);

      return () => {
        const currentRuntime = roomRuntimes.get(roomId);

        if (!currentRuntime) {
          return;
        }

        currentRuntime.subscribers.delete(listener);
      };
    },
    markParticipantRealtimeConnected(roomId: string, actor: Extract<AuthActor, { role: "GUEST" }>) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      if (
        participant.isConnected &&
        !participant.lastDisconnectedAt &&
        !participant.reconnectGraceEndsAt
      ) {
        return;
      }

      participant.isConnected = true;
      participant.lastDisconnectedAt = undefined;
      participant.reconnectGraceEndsAt = undefined;
      const seatIndex = getParticipantSeat(room, actor.guestId)?.seatIndex;
      const roomEventNo = emitRoomRefresh(room, ["participants"]);

      emitRoomEvent(room.roomId, {
        type: "PLAYER_RECONNECTED",
        roomId: room.roomId,
        roomEventNo,
        participantId: actor.guestId,
        seatIndex,
        reconnectedAt: toIso(clock())
      });
    },
    markParticipantRealtimeDisconnected(
      roomId: string,
      actor: Extract<AuthActor, { role: "GUEST" }>
    ) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);

      if (!participant) {
        return;
      }

      participant.isConnected = false;
      participant.lastDisconnectedAt = clock();
      participant.reconnectGraceEndsAt = new Date(
        participant.lastDisconnectedAt.getTime() + RECONNECT_GRACE_MS
      );
      const seatIndex = getParticipantSeat(room, actor.guestId)?.seatIndex;
      const roomEventNo = emitRoomRefresh(room, ["participants"]);

      emitRoomEvent(room.roomId, {
        type: "PLAYER_DISCONNECTED",
        roomId: room.roomId,
        roomEventNo,
        participantId: actor.guestId,
        seatIndex,
        disconnectedAt: toIso(participant.lastDisconnectedAt),
        reconnectGraceEndsAt: toIso(participant.reconnectGraceEndsAt)
      });
    },
    joinRoom(code: string, nickname: string, mode: RoomJoinMode, env: TokenEnv): GuestSessionResult {
      const normalizedNickname = normalizeNickname(nickname);
      const room = getRoomRecordByCode(code);

      if (room.status === "CLOSED") {
        throw appError({
          code: "ERR_ROOM_CLOSED",
          message: "This room is no longer accepting joins.",
          statusCode: 409,
          retryable: false
        });
      }

      if (mode === "SPECTATOR" && !room.config.spectatorsAllowed) {
        throw appError({
          code: "ERR_SPECTATOR_DISABLED",
          message: "Spectator access is disabled for this room.",
          statusCode: 403,
          retryable: false
        });
      }

      for (const participant of room.participants.values()) {
        if (participant.nickname.toLowerCase() === normalizedNickname.toLowerCase()) {
          throw appError({
            code: "ERR_JOIN_NAME_CONFLICT",
            message: "That nickname is already active in this room.",
            statusCode: 409,
            retryable: true
          });
        }
      }

      if (
        mode === "PLAYER" &&
        !room.seats.some((seat) => seat.status === "EMPTY") &&
        !room.config.waitingListEnabled
      ) {
        throw appError({
          code: "ERR_ROOM_FULL",
          message: "This room is full and the waiting list is disabled.",
          statusCode: 409,
          retryable: true
        });
      }

      const actor: Extract<AuthActor, { role: "GUEST" }> = {
        role: "GUEST",
        guestId: `guest_${randomUUID()}`,
        nickname: normalizedNickname,
        mode,
        roomId: room.roomId,
        roomCode: room.code
      };
      const issuedSession = createSession(actor, env);

      room.participants.set(actor.guestId, {
        participantId: actor.guestId,
        sessionId: issuedSession.session.sessionId,
        nickname: normalizedNickname,
        mode,
        joinedAt: clock(),
        isConnected: true,
        isReady: false,
        isSittingOut: mode === "SPECTATOR"
      });

      addAuditEvent({
        type: "ROOM_GUEST_JOINED",
        roomId: room.roomId,
        actorId: actor.guestId,
        detail: `${normalizedNickname} joined as ${mode}`
      });

      emitRoomRefresh(room, ["room", "participants"]);

      return {
        session: issuedSession.session,
        actor,
        lobbySnapshot: toLobbySnapshot(room, actor.guestId),
        accessToken: issuedSession.accessToken,
        refreshToken: issuedSession.refreshToken
      };
    },
    getBuyInQuote(roomId: string, actor: AuthActor) {
      const room = getRoomRecordById(roomId);

      if (actor.role === "ADMIN" && room.adminId !== actor.adminId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This admin cannot view that room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.role === "GUEST" && actor.roomId !== roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      return toBuyInQuote(room);
    },
    playerReady(
      roomId: string,
      actor: Extract<AuthActor, { role: "GUEST" }>,
      seatIndex?: number
    ) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.mode === "SPECTATOR") {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "Spectators cannot mark themselves ready.",
          statusCode: 403,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);
      const seat = getParticipantSeat(room, actor.guestId);

      if (!participant || !seat || seat.status !== "OCCUPIED") {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "A seated player is required before readying up.",
          statusCode: 422,
          retryable: true
        });
      }

      if (seatIndex !== undefined && seat.seatIndex !== seatIndex) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "The ready request does not match the authoritative seat assignment.",
          statusCode: 422,
          retryable: false
        });
      }

      participant.isReady = true;
      participant.isSittingOut = false;
      emitRoomRefresh(room, ["participants"]);
      startHoldemHandIfReady(room);

      return toRoomRealtimeSnapshot(room, actor);
    },
    playerSitOut(
      roomId: string,
      actor: Extract<AuthActor, { role: "GUEST" }>,
      effectiveTiming: "NOW" | "NEXT_HAND"
    ) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      participant.isReady = false;
      participant.isSittingOut = true;
      emitRoomRefresh(room, ["participants"]);

      if (effectiveTiming === "NOW" && room.activeHand) {
        const seat = getParticipantSeat(room, actor.guestId);

        if (seat && getCurrentActingSeatIndex(room) === seat.seatIndex) {
          void applyPlayerAction(room, actor.guestId, {
            handId: room.activeHand.engine.handId,
            seqExpectation: getHandSequence(room.activeHand.engine),
            idempotencyKey: `sitout-${room.activeHand.engine.handId}-${getHandSequence(
              room.activeHand.engine
            )}`,
            actionType: "FOLD"
          });
        }
      }

      return toRoomRealtimeSnapshot(room, actor);
    },
    reserveSeat(roomId: string, seatIndex: number, actor: Extract<AuthActor, { role: "GUEST" }>) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.mode === "SPECTATOR") {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "Spectators cannot reserve seats.",
          statusCode: 403,
          retryable: false
        });
      }

      if (getParticipantSeat(room, actor.guestId)) {
        throw appError({
          code: "ERR_ALREADY_SEATED",
          message: "This player already holds a seat reservation.",
          statusCode: 409,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);
      const seat = room.seats.at(seatIndex);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      if (!seat) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "That seat does not exist.",
          statusCode: 422,
          retryable: false
        });
      }

      if (seat.status !== "EMPTY") {
        throw appError({
          code: "ERR_SEAT_TAKEN",
          message: "That seat is no longer open.",
          statusCode: 409,
          retryable: true
        });
      }

      seat.status = "RESERVED";
      seat.participantId = actor.guestId;
      seat.reservedUntil = new Date(
        clock().getTime() + room.config.seatReservationTimeoutSeconds * 1000
      );
      seat.reservationToken = randomUUID();
      room.waitingList = room.waitingList.filter((entry) => entry.participantId !== actor.guestId);
      participant.isReady = false;
      participant.isSittingOut = false;
      scheduleReservationExpiry(room, seat);

      addAuditEvent({
        type: "ROOM_SEAT_RESERVED",
        roomId,
        actorId: actor.guestId,
        detail: `${participant.nickname} reserved seat ${seatIndex}`
      });

      emitRoomRefresh(room, ["room", "seats", "participants", "waitingList"]);

      return seatReservationResponseSchema.parse({
        reservedSeatIndex: seatIndex,
        reservedUntil: toIso(seat.reservedUntil),
        buyInQuote: toBuyInQuote(room),
        lobbySnapshot: toLobbySnapshot(room, actor.guestId)
      });
    },
    joinWaitingList(roomId: string, actor: Extract<AuthActor, { role: "GUEST" }>) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.mode === "SPECTATOR") {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "Spectators cannot join the waiting list.",
          statusCode: 403,
          retryable: false
        });
      }

      if (!room.config.waitingListEnabled) {
        throw appError({
          code: "ERR_ROOM_FULL",
          message: "This room does not allow waiting-list joins.",
          statusCode: 409,
          retryable: false
        });
      }

      if (room.seats.some((seat) => seat.status === "EMPTY")) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "Open seats are still available, so queueing is not needed.",
          statusCode: 409,
          retryable: true
        });
      }

      if (getParticipantSeat(room, actor.guestId)) {
        throw appError({
          code: "ERR_ALREADY_SEATED",
          message: "This player already holds a seat reservation.",
          statusCode: 409,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);
      const existing = room.waitingList.find((entry) => entry.participantId === actor.guestId);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      if (existing) {
        throw appError({
          code: "ERR_ALREADY_QUEUED",
          message: "This player is already on the waiting list.",
          statusCode: 409,
          retryable: false
        });
      }

      const queueEntry: QueueEntryRecord = {
        entryId: `queue_${randomUUID()}`,
        participantId: actor.guestId,
        nickname: participant.nickname,
        joinedAt: clock()
      };

      room.waitingList.push(queueEntry);

      addAuditEvent({
        type: "ROOM_WAITING_LIST_JOINED",
        roomId,
        actorId: actor.guestId,
        detail: `${participant.nickname} joined the waiting list`
      });

      emitRoomRefresh(room, ["room", "waitingList", "participants"]);

      return {
        queueEntry: queueEntrySchema.parse({
          entryId: queueEntry.entryId,
          participantId: queueEntry.participantId,
          nickname: queueEntry.nickname,
          joinedAt: toIso(queueEntry.joinedAt),
          position: room.waitingList.length
        }),
        lobbySnapshot: toLobbySnapshot(room, actor.guestId)
      };
    },
    buyIn(
      roomId: string,
      seatIndex: number,
      amount: number,
      actor: Extract<AuthActor, { role: "GUEST" }>,
      idempotencyKey?: string
    ) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.mode === "SPECTATOR") {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "Spectators cannot commit a buy-in.",
          statusCode: 403,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);
      const seat = room.seats.at(seatIndex);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      if (!seat) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "That seat does not exist.",
          statusCode: 422,
          retryable: false
        });
      }

      const fingerprint = JSON.stringify({ seatIndex, amount });
      const cached = getCachedLedgerOperation(
        room,
        actor.guestId,
        "BUY_IN",
        idempotencyKey,
        fingerprint
      );

      if (cached) {
        return buyInResponseSchema.parse(cached);
      }

      if (seat.status !== "RESERVED" || seat.participantId !== actor.guestId) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "A matching seat reservation is required before buying in.",
          statusCode: 422,
          retryable: false
        });
      }

      assertBuyInAmountWithinRange(room, amount);

      const ledgerEntry = commitLedgerEntry(room, {
        participantId: actor.guestId,
        seatIndex,
        type: "BUY_IN",
        delta: amount,
        idempotencyKey
      });

      clearReservationTimer(room.roomId, seatIndex);
      seat.status = "OCCUPIED";
      seat.reservedUntil = undefined;
      seat.reservationToken = undefined;
      seat.stack = amount;
      participant.isReady = false;
      participant.isSittingOut = false;

      addAuditEvent({
        type: "BUYIN_COMMITTED",
        roomId,
        actorId: actor.guestId,
        detail: `${participant.nickname} committed ${amount.toLocaleString()} chips at seat ${
          seatIndex + 1
        }`
      });

      const lobbySnapshot = toLobbySnapshot(room, actor.guestId);
      const response = buyInResponseSchema.parse({
        operation: "BUY_IN",
        tablePhase: room.tablePhase,
        seat: toSeatSnapshot(room, seat),
        ledgerEntry: toLedgerEntry(ledgerEntry),
        balance: toRoomBalanceSummary(room, actor.guestId),
        lobbySnapshot
      });

      storeLedgerOperation(
        room,
        actor.guestId,
        "BUY_IN",
        idempotencyKey,
        fingerprint,
        response
      );

      emitRoomRefresh(room, ["room", "seats", "participants", "buyInQuote"]);

      return response;
    },
    rebuy(
      roomId: string,
      amount: number,
      actor: Extract<AuthActor, { role: "GUEST" }>,
      idempotencyKey?: string
    ) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.mode === "SPECTATOR") {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "Spectators cannot rebuy.",
          statusCode: 403,
          retryable: false
        });
      }

      if (!room.config.rebuyEnabled) {
        throw appError({
          code: "ERR_REBUY_DISABLED",
          message: "Rebuys are disabled for this room.",
          statusCode: 409,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);
      const seat = getParticipantSeat(room, actor.guestId);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      if (!seat || seat.status !== "OCCUPIED") {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "You need an occupied seat to rebuy.",
          statusCode: 422,
          retryable: false
        });
      }

      if ((seat.stack ?? 0) > 0) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "Rebuy is only available after your current stack reaches zero.",
          statusCode: 422,
          retryable: true
        });
      }

      const fingerprint = JSON.stringify({ amount });
      const cached = getCachedLedgerOperation(
        room,
        actor.guestId,
        "REBUY",
        idempotencyKey,
        fingerprint
      );

      if (cached) {
        return rebuyResponseSchema.parse(cached);
      }

      assertBuyInAmountWithinRange(room, amount);

      const ledgerEntry = commitLedgerEntry(room, {
        participantId: actor.guestId,
        seatIndex: seat.seatIndex,
        type: "REBUY",
        delta: amount,
        idempotencyKey
      });

      seat.stack = amount;
      participant.isReady = false;

      addAuditEvent({
        type: "BUYIN_COMMITTED",
        roomId,
        actorId: actor.guestId,
        detail: `${participant.nickname} rebought ${amount.toLocaleString()} chips at seat ${
          seat.seatIndex + 1
        }`
      });

      const lobbySnapshot = toLobbySnapshot(room, actor.guestId);
      const response = rebuyResponseSchema.parse({
        operation: "REBUY",
        tablePhase: room.tablePhase,
        seat: toSeatSnapshot(room, seat),
        ledgerEntry: toLedgerEntry(ledgerEntry),
        balance: toRoomBalanceSummary(room, actor.guestId),
        lobbySnapshot
      });

      storeLedgerOperation(
        room,
        actor.guestId,
        "REBUY",
        idempotencyKey,
        fingerprint,
        response
      );

      emitRoomRefresh(room, ["seats", "participants"]);

      return response;
    },
    topUp(
      roomId: string,
      amount: number,
      actor: Extract<AuthActor, { role: "GUEST" }>,
      idempotencyKey?: string
    ) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.mode === "SPECTATOR") {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "Spectators cannot top up a seat.",
          statusCode: 403,
          retryable: false
        });
      }

      if (!room.config.topUpEnabled) {
        throw appError({
          code: "ERR_TOPUP_DISABLED",
          message: "Top-ups are disabled for this room.",
          statusCode: 409,
          retryable: false
        });
      }

      assertRoomIsBetweenHands(room);

      const participant = room.participants.get(actor.guestId);
      const seat = getParticipantSeat(room, actor.guestId);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      if (!seat || seat.status !== "OCCUPIED") {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "You need an occupied seat to top up.",
          statusCode: 422,
          retryable: false
        });
      }

      if ((seat.stack ?? 0) <= 0) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "Use rebuy after your stack reaches zero.",
          statusCode: 422,
          retryable: true
        });
      }

      const { maxChips } = getChipRange(room);
      const nextStack = (seat.stack ?? 0) + amount;

      if (nextStack > maxChips) {
        throw appError({
          code: "ERR_MAX_BUYIN",
          message: `Top-up cannot take you above ${maxChips.toLocaleString()} chips.`,
          statusCode: 422,
          retryable: true
        });
      }

      const fingerprint = JSON.stringify({ amount });
      const cached = getCachedLedgerOperation(
        room,
        actor.guestId,
        "TOP_UP",
        idempotencyKey,
        fingerprint
      );

      if (cached) {
        return topUpResponseSchema.parse(cached);
      }

      const ledgerEntry = commitLedgerEntry(room, {
        participantId: actor.guestId,
        seatIndex: seat.seatIndex,
        type: "TOP_UP",
        delta: amount,
        idempotencyKey
      });

      seat.stack = nextStack;
      participant.isReady = false;

      addAuditEvent({
        type: "BUYIN_COMMITTED",
        roomId,
        actorId: actor.guestId,
        detail: `${participant.nickname} topped up ${amount.toLocaleString()} chips at seat ${
          seat.seatIndex + 1
        }`
      });

      const lobbySnapshot = toLobbySnapshot(room, actor.guestId);
      const response = topUpResponseSchema.parse({
        operation: "TOP_UP",
        tablePhase: room.tablePhase,
        seat: toSeatSnapshot(room, seat),
        ledgerEntry: toLedgerEntry(ledgerEntry),
        balance: toRoomBalanceSummary(room, actor.guestId),
        lobbySnapshot
      });

      storeLedgerOperation(
        room,
        actor.guestId,
        "TOP_UP",
        idempotencyKey,
        fingerprint,
        response
      );

      emitRoomRefresh(room, ["seats", "participants"]);

      return response;
    },
    submitAction(
      roomId: string,
      actor: Extract<AuthActor, { role: "GUEST" }>,
      payload: {
        handId: string;
        seqExpectation: number;
        idempotencyKey: string;
        actionType: "CHECK" | "FOLD" | "CALL" | "BET" | "RAISE" | "ALL_IN";
        amount?: number;
      }
    ) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      return applyPlayerAction(room, actor.guestId, payload, {
        emitAcceptedEvent: false
      });
    },
    pauseRoom(roomId: string, actor: Extract<AuthActor, { role: "ADMIN" }>, reason?: string) {
      const room = getRoomRecordById(roomId);

      if (room.adminId !== actor.adminId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This admin cannot pause that room.",
          statusCode: 403,
          retryable: false
        });
      }

      pauseRoomInternal(room, reason ?? "Room manually paused by the admin.");
      return toRoomRealtimeSnapshot(room, actor);
    },
    resumeRoom(roomId: string, actor: Extract<AuthActor, { role: "ADMIN" }>) {
      const room = getRoomRecordById(roomId);

      if (room.adminId !== actor.adminId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This admin cannot resume that room.",
          statusCode: 403,
          retryable: false
        });
      }

      resumeRoomInternal(room);
      return toRoomRealtimeSnapshot(room, actor);
    },
    getAuthContext(accessToken: string | undefined, env: TokenEnv): AuthContext | null {
      const session = getSessionRecordFromToken(accessToken, env, "access");

      if (!session) {
        return null;
      }

      return {
        session: {
          sessionId: session.sessionId,
          role: session.role,
          issuedAt: toIso(session.issuedAt),
          expiresAt: toIso(session.expiresAt),
          refreshExpiresAt: toIso(session.refreshExpiresAt)
        },
        actor: session.actor
      };
    },
    refreshSession(refreshToken: string | undefined, env: TokenEnv) {
      const session = getSessionRecordFromToken(refreshToken, env, "refresh");

      if (!session) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "A valid refresh session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      addAuditEvent({
        type: "AUTH_SESSION_REFRESHED",
        actorId:
          session.actor.role === "ADMIN" ? session.actor.adminId : session.actor.guestId,
        roomId: session.actor.role === "GUEST" ? session.actor.roomId : undefined,
        detail: `Session refreshed for ${session.actor.role}`
      });

      return rotateSession(session, env);
    },
    logout(accessToken: string | undefined, refreshToken: string | undefined, env: TokenEnv) {
      const session =
        getSessionRecordFromToken(accessToken, env, "access") ??
        getSessionRecordFromToken(refreshToken, env, "refresh");

      if (!session) {
        return;
      }

      session.revokedAt = clock();

      if (session.actor.role === "GUEST") {
        const room = roomsById.get(session.actor.roomId);

        if (room) {
          cleanupRoom(room);
          removeParticipantFromRoom(room, session.actor.guestId);
          emitRoomRefresh(room, ["room", "seats", "participants", "waitingList"]);
        }
      }

      addAuditEvent({
        type: "AUTH_SESSION_LOGGED_OUT",
        actorId:
          session.actor.role === "ADMIN" ? session.actor.adminId : session.actor.guestId,
        roomId: session.actor.role === "GUEST" ? session.actor.roomId : undefined,
        detail: `Session logged out for ${session.actor.role}`
      });
    },
    getSessionTokens(result: IssueSessionResult) {
      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessMaxAgeSeconds: Math.floor(ACCESS_TTL_MS / 1000),
        refreshMaxAgeSeconds: Math.floor(REFRESH_TTL_MS / 1000)
      };
    },
    setRoomTablePhaseForTests(roomId: string, tablePhase: RoomTablePhase) {
      const room = getRoomRecordById(roomId);
      room.tablePhase = tablePhase;
    },
    setSeatStackForTests(roomId: string, participantId: string, stack: number) {
      const room = getRoomRecordById(roomId);
      const seat = getParticipantSeat(room, participantId);

      if (!seat) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "That participant does not currently hold a seat.",
          statusCode: 422,
          retryable: false
        });
      }

      seat.status = "OCCUPIED";
      seat.stack = stack;
      seat.reservedUntil = undefined;
    },
    applyCompensatingAdjustmentForTests(
      roomId: string,
      participantId: string,
      amount: number,
      idempotencyKey?: string
    ) {
      const room = getRoomRecordById(roomId);
      const seat = getParticipantSeat(room, participantId);
      const currentStack = seat?.stack ?? 0;
      const nextStack = Math.max(0, currentStack - amount);
      const ledgerEntry = commitLedgerEntry(room, {
        participantId,
        seatIndex: seat?.seatIndex,
        type: "COMPENSATING_ADJUSTMENT",
        delta: -Math.abs(amount),
        idempotencyKey
      });

      if (seat) {
        seat.stack = nextStack;
      }

      return {
        ledgerEntry: toLedgerEntry(ledgerEntry),
        balance: toRoomBalanceSummary(room, participantId)
      };
    },
    getRoomBalanceSummary(roomId: string, participantId: string) {
      const room = getRoomRecordById(roomId);
      return toRoomBalanceSummary(room, participantId);
    },
    getLedgerEntries(roomId: string, participantId?: string) {
      const room = getRoomRecordById(roomId);
      const entries = participantId
        ? getLedgerEntriesForParticipant(room, participantId)
        : room.ledgerEntries;

      return entries.map((entry) => toLedgerEntry(entry));
    },
    getAuditEvents() {
      return [...auditEvents];
    }
  };
}

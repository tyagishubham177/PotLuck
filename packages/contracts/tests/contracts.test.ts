import { describe, expect, it } from "vitest";

import {
  actionSubmitIntentSchema,
  buyInResponseSchema,
  authSessionResponseSchema,
  healthResponseSchema,
  joinRoomResponseSchema,
  realtimeServerMessageSchema,
  rebuyResponseSchema,
  roomRealtimeSnapshotSchema,
  roomCreateResponseSchema,
  seatReservationResponseSchema,
  topUpResponseSchema
} from "../src/index.js";

describe("shared contracts", () => {
  it("accepts the health payload", () => {
    const payload = healthResponseSchema.parse({
      status: "ok",
      service: "potluck-server",
      environment: "development",
      appOrigin: "http://localhost:3000",
      engine: "holdem-engine-v1"
    });

    expect(payload.service).toBe("potluck-server");
  });

  it("accepts an authenticated admin session payload", () => {
    const payload = authSessionResponseSchema.parse({
      session: {
        sessionId: "session_admin_123",
        role: "ADMIN",
        issuedAt: "2026-03-19T12:00:00.000Z",
        expiresAt: "2026-03-19T12:15:00.000Z",
        refreshExpiresAt: "2026-03-26T12:00:00.000Z"
      },
      actor: {
        role: "ADMIN",
        adminId: "admin_123",
        email: "host@example.com"
      }
    });

    expect(payload.actor.role).toBe("ADMIN");
  });

  it("accepts a room creation payload", () => {
    const payload = roomCreateResponseSchema.parse({
      room: {
        roomId: "room_123",
        code: "DEMO42",
        tableName: "Practice Table",
        status: "OPEN",
        joinLocked: false,
        maxSeats: 6,
        openSeatCount: 6,
        reservedSeatCount: 0,
        occupiedSeatCount: 0,
        participantCount: 0,
        queuedCount: 0,
        spectatorsAllowed: true,
        waitingListEnabled: true,
        joinCodeExpiresAt: "2026-03-19T14:00:00.000Z",
        createdAt: "2026-03-19T12:00:00.000Z",
        closesAt: "2026-03-20T00:00:00.000Z"
      },
      lobbySnapshot: {
        room: {
          roomId: "room_123",
          code: "DEMO42",
          tableName: "Practice Table",
          status: "OPEN",
          joinLocked: false,
          maxSeats: 6,
          openSeatCount: 6,
          reservedSeatCount: 0,
          occupiedSeatCount: 0,
          participantCount: 0,
          queuedCount: 0,
          spectatorsAllowed: true,
          waitingListEnabled: true,
          joinCodeExpiresAt: "2026-03-19T14:00:00.000Z",
          createdAt: "2026-03-19T12:00:00.000Z",
          closesAt: "2026-03-20T00:00:00.000Z"
        },
        config: {
          tableName: "Practice Table",
          maxSeats: 6,
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
        seats: Array.from({ length: 6 }, (_, seatIndex) => ({
          seatIndex,
          status: "EMPTY"
        })),
        waitingList: [],
        participants: [],
        buyInQuote: {
          roomId: "room_123",
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
        canJoinWaitingList: false
      }
    });

    expect(payload.room.code).toBe("DEMO42");
  });

  it("accepts a guest join and seat reservation payload", () => {
    const joinPayload = joinRoomResponseSchema.parse({
      session: {
        sessionId: "session_guest_123",
        role: "GUEST",
        issuedAt: "2026-03-19T12:00:00.000Z",
        expiresAt: "2026-03-19T12:15:00.000Z",
        refreshExpiresAt: "2026-03-26T12:00:00.000Z"
      },
      actor: {
        role: "GUEST",
        guestId: "guest_123",
        nickname: "RiverKid",
        mode: "PLAYER",
        roomId: "room_123",
        roomCode: "DEMO42"
      },
      lobbySnapshot: {
        room: {
          roomId: "room_123",
          code: "DEMO42",
          tableName: "Practice Table",
          status: "OPEN",
          joinLocked: false,
          maxSeats: 6,
          openSeatCount: 6,
          reservedSeatCount: 0,
          occupiedSeatCount: 0,
          participantCount: 1,
          queuedCount: 0,
          spectatorsAllowed: true,
          waitingListEnabled: true,
          joinCodeExpiresAt: "2026-03-19T14:00:00.000Z",
          createdAt: "2026-03-19T12:00:00.000Z",
          closesAt: "2026-03-20T00:00:00.000Z"
        },
        config: {
          tableName: "Practice Table",
          maxSeats: 6,
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
        seats: Array.from({ length: 6 }, (_, seatIndex) => ({
          seatIndex,
          status: "EMPTY"
        })),
        waitingList: [],
        participants: [
          {
            participantId: "guest_123",
            nickname: "RiverKid",
            mode: "PLAYER",
            state: "LOBBY",
            joinedAt: "2026-03-19T12:00:00.000Z",
            isConnected: true
          }
        ],
        buyInQuote: {
          roomId: "room_123",
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
        heroParticipantId: "guest_123",
        canJoinWaitingList: false
      }
    });

    const seatPayload = seatReservationResponseSchema.parse({
      reservedSeatIndex: 2,
      reservedUntil: "2026-03-19T12:02:00.000Z",
      buyInQuote: joinPayload.lobbySnapshot.buyInQuote,
      lobbySnapshot: {
        ...joinPayload.lobbySnapshot,
        room: {
          ...joinPayload.lobbySnapshot.room,
          openSeatCount: 5,
          reservedSeatCount: 1
        },
        seats: joinPayload.lobbySnapshot.seats.map((seat) =>
          seat.seatIndex === 2
            ? {
                seatIndex: 2,
                status: "RESERVED",
                participantId: "guest_123",
                nickname: "RiverKid",
                reservedUntil: "2026-03-19T12:02:00.000Z"
              }
            : seat
        ),
        participants: [
          {
            participantId: "guest_123",
            nickname: "RiverKid",
            mode: "PLAYER",
            state: "RESERVED",
            joinedAt: "2026-03-19T12:00:00.000Z",
            isConnected: true,
            seatIndex: 2,
            reservationExpiresAt: "2026-03-19T12:02:00.000Z"
          }
        ],
        heroSeatIndex: 2
      }
    });

    expect(seatPayload.reservedSeatIndex).toBe(2);
  });

  it("accepts buy-in, rebuy, and top-up ledger payloads", () => {
    const basePayload = {
      tablePhase: "BETWEEN_HANDS",
      seat: {
        seatIndex: 2,
        status: "OCCUPIED",
        participantId: "guest_123",
        nickname: "RiverKid",
        stack: 7000
      },
      ledgerEntry: {
        entryId: "ledger_123",
        roomId: "room_123",
        participantId: "guest_123",
        seatIndex: 2,
        type: "BUY_IN",
        delta: 7000,
        balanceAfter: 7000,
        referenceId: "op_123",
        idempotencyKey: "buyin-riverkid-1",
        createdAt: "2026-03-19T12:05:00.000Z"
      },
      balance: {
        roomId: "room_123",
        participantId: "guest_123",
        seatIndex: 2,
        buyInCommitted: 7000,
        rebuyCommitted: 0,
        topUpCommitted: 0,
        adjustmentTotal: 0,
        totalCommitted: 7000,
        netBalance: 7000,
        liveStack: 7000
      },
      lobbySnapshot: {
        room: {
          roomId: "room_123",
          code: "DEMO42",
          tableName: "Practice Table",
          status: "OPEN",
          joinLocked: false,
          maxSeats: 6,
          openSeatCount: 5,
          reservedSeatCount: 0,
          occupiedSeatCount: 1,
          participantCount: 1,
          queuedCount: 0,
          spectatorsAllowed: true,
          waitingListEnabled: true,
          joinCodeExpiresAt: "2026-03-19T14:00:00.000Z",
          createdAt: "2026-03-19T12:00:00.000Z",
          closesAt: "2026-03-20T00:00:00.000Z"
        },
        config: {
          tableName: "Practice Table",
          maxSeats: 6,
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
        seats: Array.from({ length: 6 }, (_, seatIndex) =>
          seatIndex === 2
            ? {
                seatIndex,
                status: "OCCUPIED",
                participantId: "guest_123",
                nickname: "RiverKid",
                stack: 7000
              }
            : {
                seatIndex,
                status: "EMPTY"
              }
        ),
        waitingList: [],
        participants: [
          {
            participantId: "guest_123",
            nickname: "RiverKid",
            mode: "PLAYER",
            state: "SEATED",
            joinedAt: "2026-03-19T12:00:00.000Z",
            isConnected: true,
            seatIndex: 2
          }
        ],
        buyInQuote: {
          roomId: "room_123",
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
        heroParticipantId: "guest_123",
        heroSeatIndex: 2,
        canJoinWaitingList: false
      }
    };

    const buyInPayload = buyInResponseSchema.parse({
      ...basePayload,
      operation: "BUY_IN"
    });

    const rebuyPayload = rebuyResponseSchema.parse({
      ...basePayload,
      operation: "REBUY",
      seat: {
        ...basePayload.seat,
        stack: 12000
      },
      ledgerEntry: {
        ...basePayload.ledgerEntry,
        type: "REBUY",
        delta: 5000,
        balanceAfter: 12000
      },
      balance: {
        ...basePayload.balance,
        rebuyCommitted: 5000,
        totalCommitted: 12000,
        netBalance: 12000,
        liveStack: 12000
      }
    });

    const topUpPayload = topUpResponseSchema.parse({
      ...basePayload,
      operation: "TOP_UP",
      seat: {
        ...basePayload.seat,
        stack: 9000
      },
      ledgerEntry: {
        ...basePayload.ledgerEntry,
        type: "TOP_UP",
        delta: 2000,
        balanceAfter: 14000
      },
      balance: {
        ...basePayload.balance,
        topUpCommitted: 2000,
        totalCommitted: 14000,
        netBalance: 14000,
        liveStack: 9000
      }
    });

    expect(buyInPayload.ledgerEntry.type).toBe("BUY_IN");
    expect(rebuyPayload.balance.totalCommitted).toBe(12000);
    expect(topUpPayload.seat.stack).toBe(9000);
  });

  it("accepts realtime room snapshots, diffs, and action intents", () => {
    const snapshot = roomRealtimeSnapshotSchema.parse({
      room: {
        roomId: "room_123",
        code: "DEMO42",
        tableName: "Realtime Table",
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
        tableName: "Realtime Table",
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
          participantId: "guest_alpha",
          nickname: "Alpha",
          stack: 5000
        },
        {
          seatIndex: 1,
          status: "OCCUPIED",
          participantId: "guest_bravo",
          nickname: "Bravo",
          stack: 5000
        }
      ],
      waitingList: [],
      participants: [
        {
          participantId: "guest_alpha",
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
          participantId: "guest_bravo",
          nickname: "Bravo",
          mode: "PLAYER",
          state: "SEATED",
          joinedAt: "2026-03-19T12:01:00.000Z",
          isConnected: true,
          seatIndex: 1,
          isReady: false,
          isSittingOut: false
        }
      ],
      buyInQuote: {
        roomId: "room_123",
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
      heroParticipantId: "guest_alpha",
      heroSeatIndex: 0,
      canJoinWaitingList: false,
      tablePhase: "BETWEEN_HANDS",
      roomEventNo: 3,
      activeHand: null,
      pausedReason: null
    });

    const intent = actionSubmitIntentSchema.parse({
      type: "ACTION_SUBMIT",
      roomId: "room_123",
      handId: "hand_123",
      seqExpectation: 2,
      idempotencyKey: "alpha-check-2",
      actionType: "CHECK"
    });

    const serverEvent = realtimeServerMessageSchema.parse({
      type: "TURN_STARTED",
      roomId: "room_123",
      roomEventNo: 4,
      handId: "hand_123",
      handSeq: 2,
      actingSeatIndex: 0,
      deadlineAt: "2026-03-19T12:05:15.000Z",
      legalActions: {
        canFold: true,
        canCheck: true,
        presetAmounts: []
      }
    });

    const streetEvent = realtimeServerMessageSchema.parse({
      type: "STREET_ADVANCED",
      roomId: "room_123",
      roomEventNo: 5,
      handId: "hand_123",
      handSeq: 3,
      street: "FLOP",
      board: ["AS", "KH", "QD"],
      revealedCards: ["AS", "KH", "QD"]
    });

    expect(snapshot.roomEventNo).toBe(3);
    expect(intent.actionType).toBe("CHECK");
    expect(serverEvent.type).toBe("TURN_STARTED");
    expect(streetEvent.type).toBe("STREET_ADVANCED");
  });
});

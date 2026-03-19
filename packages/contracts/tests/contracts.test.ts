import { describe, expect, it } from "vitest";

import {
  authSessionResponseSchema,
  healthResponseSchema,
  joinRoomResponseSchema,
  roomCreateResponseSchema,
  seatReservationResponseSchema
} from "../src/index.js";

describe("shared contracts", () => {
  it("accepts the health payload", () => {
    const payload = healthResponseSchema.parse({
      status: "ok",
      service: "potluck-server",
      environment: "development",
      appOrigin: "http://localhost:3000",
      engine: "foundation-placeholder-engine"
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
});

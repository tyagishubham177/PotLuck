import { describe, expect, it } from "vitest";

import {
  authSessionResponseSchema,
  healthResponseSchema,
  joinRoomResponseSchema
} from "../src/index.js";

describe("healthResponseSchema", () => {
  it("accepts the foundation health payload", () => {
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

  it("accepts a guest join response payload", () => {
    const payload = joinRoomResponseSchema.parse({
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
          tableName: "Phase One Demo",
          status: "OPEN",
          maxSeats: 6,
          openSeatCount: 5,
          occupantCount: 1,
          spectatorsAllowed: true,
          joinCodeExpiresAt: "2026-03-19T14:00:00.000Z",
          createdAt: "2026-03-19T11:00:00.000Z"
        },
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
        heroParticipantId: "guest_123"
      }
    });

    expect(payload.lobbySnapshot.room.code).toBe("DEMO42");
  });
});

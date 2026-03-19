import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type EmailAdapter } from "./email.js";
import { buildServer } from "./server.js";
import { createAppState } from "./state.js";

const sentOtps: Array<{ email: string; code: string; challengeId: string }> = [];

const emailAdapter: EmailAdapter = {
  async sendAdminOtp(payload) {
    sentOtps.push({
      email: payload.email,
      code: payload.code,
      challengeId: payload.challengeId
    });
  }
};

const state = createAppState();

const app = buildServer({
  env: {
    NODE_ENV: "test",
    PORT: "3001",
    APP_ORIGIN: "http://localhost:3000",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/potluck?sslmode=require",
    DIRECT_DATABASE_URL: "postgresql://user:pass@localhost:5432/potluck?sslmode=require",
    SESSION_SIGNING_SECRET: "session-session-session-session-session",
    GUEST_SESSION_SIGNING_SECRET: "guest-guest-guest-guest-guest-guest",
    ADMIN_OTP_SIGNING_SECRET: "otp-otp-otp-otp-otp-otp-otp-otp-otp",
    COOKIE_SECRET: "cookie-cookie-cookie-cookie-cookie-cookie",
    RESEND_API_KEY: "re_dummy_resend_api_key",
    RESEND_FROM_EMAIL: "PotLuck Sandbox <onboarding@resend.dev>",
    REDIS_URL: "redis://default:dummy-password@localhost:6379",
    SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
    SENTRY_AUTH_TOKEN: "sntrys_dummy_auth_token",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp-gateway-prod-us-central-0.grafana.net/otlp",
    OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic ZHVtbXktaW5zdGFuY2U6ZHVtbXktdG9rZW4="
  },
  emailAdapter,
  state
});

function getCookieHeader(setCookieHeaders: string[]) {
  return setCookieHeaders.map((entry) => entry.split(";")[0]).join("; ");
}

async function createAdminCookieHeader(
  email = `host-${Date.now()}-${Math.random()}@example.com`,
  targetApp = app
) {
  const remoteAddress = `10.0.${Math.floor(Math.random() * 200) + 1}.${Math.floor(
    Math.random() * 200
  ) + 1}`;

  const requestOtpResponse = await targetApp.inject({
    method: "POST",
    url: "/api/auth/admin/request-otp",
    payload: { email },
    remoteAddress
  });
  const otpPayload = requestOtpResponse.json();
  const sentOtp = sentOtps.at(-1);

  const verifyResponse = await targetApp.inject({
    method: "POST",
    url: "/api/auth/admin/verify-otp",
    payload: {
      challengeId: otpPayload.challengeId,
      code: sentOtp?.code
    },
    remoteAddress
  });

  const sessionCookies = verifyResponse.headers["set-cookie"];
  return getCookieHeader(
    Array.isArray(sessionCookies) ? sessionCookies : [sessionCookies ?? ""]
  );
}

async function createRoom(
  adminCookieHeader: string,
  overrides: Record<string, unknown> = {},
  targetApp = app
) {
  const response = await targetApp.inject({
    method: "POST",
    url: "/api/rooms",
    headers: { cookie: adminCookieHeader },
    payload: {
      tableName: "Practice Table",
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
      seatReservationTimeoutSeconds: 120,
      joinCodeExpiryMinutes: 120,
      waitingListEnabled: true,
      roomMaxDurationMinutes: 720,
      ...overrides
    }
  });

  expect(response.statusCode).toBe(200);
  return response.json();
}

async function joinRoom(
  code: string,
  nickname: string,
  mode: "PLAYER" | "SPECTATOR" = "PLAYER",
  targetApp = app
) {
  const response = await targetApp.inject({
    method: "POST",
    url: `/api/rooms/${code}/join`,
    payload: { nickname, mode }
  });

  const sessionCookies = response.headers["set-cookie"];

  return {
    response,
    cookieHeader: getCookieHeader(
      Array.isArray(sessionCookies) ? sessionCookies : [sessionCookies ?? ""]
    )
  };
}

async function reserveSeat(
  roomId: string,
  seatIndex: number,
  cookieHeader: string,
  targetApp = app
) {
  return targetApp.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/seats/${seatIndex}`,
    headers: { cookie: cookieHeader },
    payload: {}
  });
}

async function commitBuyIn(
  roomId: string,
  seatIndex: number,
  amount: number,
  cookieHeader: string,
  idempotencyKey?: string,
  targetApp = app
) {
  return targetApp.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/buyin`,
    headers: {
      cookie: cookieHeader,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    payload: {
      seatIndex,
      amount
    }
  });
}

describe("phase 02 and phase 03 room flow", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the baseline health payload", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "potluck-server",
      environment: "test"
    });
  });

  it("creates a room from an authenticated admin session", async () => {
    const adminCookieHeader = await createAdminCookieHeader();
    const createResponse = await createRoom(adminCookieHeader, {
      tableName: "Admin Table",
      maxSeats: 6
    });

    expect(createResponse.room).toMatchObject({
      tableName: "Admin Table",
      openSeatCount: 6,
      queuedCount: 0
    });
    expect(createResponse.room.code).toHaveLength(6);
    expect(createResponse.lobbySnapshot.buyInQuote.minChips).toBe(4000);
  });

  it("supports joining, reserving seats, and waiting-list entry", async () => {
    const adminCookieHeader = await createAdminCookieHeader();
    const room = await createRoom(adminCookieHeader, { tableName: "Queue Table" });

    const alpha = await joinRoom(room.room.code, "Alpha");
    expect(alpha.response.statusCode).toBe(200);

    const alphaReserve = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.room.roomId}/seats/0`,
      headers: { cookie: alpha.cookieHeader },
      payload: {}
    });

    expect(alphaReserve.statusCode).toBe(200);
    expect(alphaReserve.json()).toMatchObject({
      reservedSeatIndex: 0,
      lobbySnapshot: {
        heroSeatIndex: 0
      }
    });

    const bravo = await joinRoom(room.room.code, "Bravo");
    const bravoReserve = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.room.roomId}/seats/1`,
      headers: { cookie: bravo.cookieHeader },
      payload: {}
    });

    expect(bravoReserve.statusCode).toBe(200);

    const charlie = await joinRoom(room.room.code, "Charlie");
    expect(charlie.response.statusCode).toBe(200);

    const queueResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.room.roomId}/queue`,
      headers: { cookie: charlie.cookieHeader },
      payload: {}
    });

    expect(queueResponse.statusCode).toBe(200);
    expect(queueResponse.json()).toMatchObject({
      queueEntry: {
        position: 1,
        nickname: "Charlie"
      },
      lobbySnapshot: {
        room: {
          queuedCount: 1,
          openSeatCount: 0,
          reservedSeatCount: 2
        }
      }
    });
  });

  it("returns buy-in quotes and lobby snapshots for a guest session", async () => {
    const adminCookieHeader = await createAdminCookieHeader();
    const room = await createRoom(adminCookieHeader, {
      buyInMode: "ABSOLUTE",
      minBuyIn: 5000,
      maxBuyIn: 20000
    });

    const guest = await joinRoom(room.room.code, "QuoteHero");

    const quoteResponse = await app.inject({
      method: "GET",
      url: `/api/rooms/${room.room.roomId}/buyin/quote`,
      headers: { cookie: guest.cookieHeader }
    });

    expect(quoteResponse.statusCode).toBe(200);
    expect(quoteResponse.json()).toMatchObject({
      mode: "ABSOLUTE",
      minChips: 5000,
      maxChips: 20000
    });

    const lobbyResponse = await app.inject({
      method: "GET",
      url: `/api/rooms/${room.room.roomId}/lobby`,
      headers: { cookie: guest.cookieHeader }
    });

    expect(lobbyResponse.statusCode).toBe(200);
    expect(lobbyResponse.json()).toMatchObject({
      heroParticipantId: expect.any(String),
      room: {
        code: room.room.code
      }
    });
  });

  it("commits a buy-in once and replays the same response for an idempotent retry", async () => {
    const adminCookieHeader = await createAdminCookieHeader();
    const room = await createRoom(adminCookieHeader, {});
    const guest = await joinRoom(room.room.code, "LedgerHero");

    const reserveResponse = await reserveSeat(room.room.roomId, 0, guest.cookieHeader);
    expect(reserveResponse.statusCode).toBe(200);

    const firstBuyIn = await commitBuyIn(
      room.room.roomId,
      0,
      5000,
      guest.cookieHeader,
      "ledgerhero-buyin-1"
    );
    const replayedBuyIn = await commitBuyIn(
      room.room.roomId,
      0,
      5000,
      guest.cookieHeader,
      "ledgerhero-buyin-1"
    );

    expect(firstBuyIn.statusCode).toBe(200);
    expect(replayedBuyIn.statusCode).toBe(200);
    expect(firstBuyIn.json()).toMatchObject({
      operation: "BUY_IN",
      seat: {
        seatIndex: 0,
        status: "OCCUPIED",
        stack: 5000
      },
      balance: {
        buyInCommitted: 5000,
        rebuyCommitted: 0,
        topUpCommitted: 0,
        totalCommitted: 5000,
        netBalance: 5000,
        liveStack: 5000
      }
    });
    expect(replayedBuyIn.json().ledgerEntry.entryId).toBe(firstBuyIn.json().ledgerEntry.entryId);
    expect(state.getLedgerEntries(room.room.roomId).length).toBe(1);
  });

  it("rejects top-ups during an active hand and blocks rebuys when the room disables them", async () => {
    const adminCookieHeader = await createAdminCookieHeader();
    const room = await createRoom(adminCookieHeader, {
      rebuyEnabled: false
    });
    const guest = await joinRoom(room.room.code, "RuleCheck");

    const reserveResponse = await reserveSeat(room.room.roomId, 0, guest.cookieHeader);
    expect(reserveResponse.statusCode).toBe(200);

    const buyInResponse = await commitBuyIn(room.room.roomId, 0, 5000, guest.cookieHeader);
    expect(buyInResponse.statusCode).toBe(200);

    state.setRoomTablePhaseForTests(room.room.roomId, "HAND_ACTIVE");

    const topUpDuringHand = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.room.roomId}/topup`,
      headers: { cookie: guest.cookieHeader, "Idempotency-Key": "rulecheck-topup-1" },
      payload: { amount: 500 }
    });

    expect(topUpDuringHand.statusCode).toBe(409);
    expect(topUpDuringHand.json()).toMatchObject({
      error: {
        code: "ERR_TOPUP_DURING_HAND"
      }
    });

    state.setRoomTablePhaseForTests(room.room.roomId, "BETWEEN_HANDS");
    state.applyCompensatingAdjustmentForTests(room.room.roomId, guest.response.json().actor.guestId, 5000);

    const rebuyDisabled = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.room.roomId}/rebuy`,
      headers: { cookie: guest.cookieHeader, "Idempotency-Key": "rulecheck-rebuy-1" },
      payload: { amount: 5000 }
    });

    expect(rebuyDisabled.statusCode).toBe(409);
    expect(rebuyDisabled.json()).toMatchObject({
      error: {
        code: "ERR_REBUY_DISABLED"
      }
    });
  });

  it("supports top-ups between hands and rebuys after a compensated bust", async () => {
    const adminCookieHeader = await createAdminCookieHeader();
    const room = await createRoom(adminCookieHeader, {});
    const guest = await joinRoom(room.room.code, "TopUpHero");
    const guestId = guest.response.json().actor.guestId as string;

    await reserveSeat(room.room.roomId, 1, guest.cookieHeader);
    await commitBuyIn(room.room.roomId, 1, 5000, guest.cookieHeader, "topuphero-buyin-1");

    const topUpResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.room.roomId}/topup`,
      headers: { cookie: guest.cookieHeader, "Idempotency-Key": "topuphero-topup-1" },
      payload: { amount: 1500 }
    });

    expect(topUpResponse.statusCode).toBe(200);
    expect(topUpResponse.json()).toMatchObject({
      operation: "TOP_UP",
      seat: {
        seatIndex: 1,
        stack: 6500
      },
      balance: {
        topUpCommitted: 1500,
        totalCommitted: 6500,
        netBalance: 6500,
        liveStack: 6500
      }
    });

    state.applyCompensatingAdjustmentForTests(room.room.roomId, guestId, 6500);

    const rebuyResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.room.roomId}/rebuy`,
      headers: { cookie: guest.cookieHeader, "Idempotency-Key": "topuphero-rebuy-1" },
      payload: { amount: 4000 }
    });

    expect(rebuyResponse.statusCode).toBe(200);
    expect(rebuyResponse.json()).toMatchObject({
      operation: "REBUY",
      seat: {
        seatIndex: 1,
        stack: 4000
      },
      balance: {
        buyInCommitted: 5000,
        rebuyCommitted: 4000,
        topUpCommitted: 1500,
        adjustmentTotal: -6500,
        totalCommitted: 10500,
        netBalance: 4000,
        liveStack: 4000
      }
    });
  });

  it("rejects spectator joins when the room disables spectator mode", async () => {
    const adminCookieHeader = await createAdminCookieHeader();
    const room = await createRoom(adminCookieHeader, {
      spectatorsAllowed: false
    });

    const spectator = await joinRoom(room.room.code, "Railbird", "SPECTATOR");

    expect(spectator.response.statusCode).toBe(403);
    expect(spectator.response.json()).toMatchObject({
      error: {
        code: "ERR_SPECTATOR_DISABLED"
      }
    });
  });

  it("supports admin config edits, join locks, and lobby kicks", async () => {
    const adminCookieHeader = await createAdminCookieHeader();
    const room = await createRoom(adminCookieHeader, {
      tableName: "Admin Ops",
      spectatorsAllowed: true
    });
    const spectator = await joinRoom(room.room.code, "Railbird", "SPECTATOR");

    expect(spectator.response.statusCode).toBe(200);

    const configResponse = await app.inject({
      method: "PATCH",
      url: `/api/rooms/${room.room.roomId}/config`,
      headers: { cookie: adminCookieHeader },
      payload: {
        tableName: "Admin Ops Late",
        smallBlind: 75,
        bigBlind: 150,
        spectatorsAllowed: false
      }
    });

    expect(configResponse.statusCode).toBe(200);
    expect(configResponse.json()).toMatchObject({
      snapshot: {
        room: {
          tableName: "Admin Ops Late"
        },
        config: {
          smallBlind: 75,
          bigBlind: 150,
          spectatorsAllowed: false
        }
      }
    });

    const lockResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.room.roomId}/lock`,
      headers: { cookie: adminCookieHeader },
      payload: {
        locked: true,
        reason: "Incident review"
      }
    });

    expect(lockResponse.statusCode).toBe(200);
    expect(lockResponse.json()).toMatchObject({
      moderation: {
        action: "ROOM_LOCKED",
        joinLocked: true
      },
      snapshot: {
        room: {
          joinLocked: true
        }
      }
    });

    const lateJoin = await joinRoom(room.room.code, "LateRail", "PLAYER");
    expect(lateJoin.response.statusCode).toBe(409);
    expect(lateJoin.response.json()).toMatchObject({
      error: {
        code: "ERR_ROOM_LOCKED"
      }
    });

    const spectatorId = spectator.response.json().actor.guestId as string;
    const kickResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.room.roomId}/kick`,
      headers: { cookie: adminCookieHeader },
      payload: {
        participantId: spectatorId,
        reason: "Clearing the rail"
      }
    });

    expect(kickResponse.statusCode).toBe(200);
    expect(kickResponse.json()).toMatchObject({
      moderation: {
        action: "PLAYER_KICKED",
        targetParticipantId: spectatorId
      }
    });

    const kickedLobbyResponse = await app.inject({
      method: "GET",
      url: `/api/rooms/${room.room.roomId}/lobby`,
      headers: { cookie: spectator.cookieHeader }
    });

    expect(kickedLobbyResponse.statusCode).toBe(401);
  });

  it("rejects config edits and seated kicks during an active hand", async () => {
    const adminCookieHeader = await createAdminCookieHeader();
    const room = await createRoom(adminCookieHeader, {});
    const alpha = await joinRoom(room.room.code, "AlphaOps");
    const bravo = await joinRoom(room.room.code, "BravoOps");

    await reserveSeat(room.room.roomId, 0, alpha.cookieHeader);
    await reserveSeat(room.room.roomId, 1, bravo.cookieHeader);
    await commitBuyIn(room.room.roomId, 0, 5000, alpha.cookieHeader, "ops-alpha-buyin-1");
    await commitBuyIn(room.room.roomId, 1, 5000, bravo.cookieHeader, "ops-bravo-buyin-1");

    const alphaActor = alpha.response.json().actor;
    const bravoActor = bravo.response.json().actor;

    state.playerReady(room.room.roomId, alphaActor, 0);
    state.playerReady(room.room.roomId, bravoActor, 1);

    const configDuringHand = await app.inject({
      method: "PATCH",
      url: `/api/rooms/${room.room.roomId}/config`,
      headers: { cookie: adminCookieHeader },
      payload: {
        smallBlind: 125
      }
    });

    expect(configDuringHand.statusCode).toBe(409);
    expect(configDuringHand.json()).toMatchObject({
      error: {
        code: "ERR_CONFIG_EDIT_DURING_HAND"
      }
    });

    const kickDuringHand = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.room.roomId}/kick`,
      headers: { cookie: adminCookieHeader },
      payload: {
        participantId: alphaActor.guestId,
        reason: "Too noisy"
      }
    });

    expect(kickDuringHand.statusCode).toBe(409);
    expect(kickDuringHand.json()).toMatchObject({
      error: {
        code: "ERR_MODERATION_DURING_HAND"
      }
    });
  });

  it("stores settled hand history and serves JSON and text transcript exports", async () => {
    const adminCookieHeader = await createAdminCookieHeader();
    const room = await createRoom(adminCookieHeader, {});
    const alpha = await joinRoom(room.room.code, "AlphaHistory");
    const bravo = await joinRoom(room.room.code, "BravoHistory");

    await reserveSeat(room.room.roomId, 0, alpha.cookieHeader);
    await reserveSeat(room.room.roomId, 1, bravo.cookieHeader);
    await commitBuyIn(room.room.roomId, 0, 5000, alpha.cookieHeader, "history-alpha-buyin-1");
    await commitBuyIn(room.room.roomId, 1, 5000, bravo.cookieHeader, "history-bravo-buyin-1");

    const alphaActor = alpha.response.json().actor;
    const bravoActor = bravo.response.json().actor;

    state.playerReady(room.room.roomId, alphaActor, 0);
    state.playerReady(room.room.roomId, bravoActor, 1);

    const liveSnapshot = state.getRoomRealtimeSnapshot(room.room.roomId, alphaActor);

    expect(liveSnapshot.activeHand?.handId).toBeTruthy();

    await state.submitAction(room.room.roomId, alphaActor, {
      handId: liveSnapshot.activeHand?.handId ?? "",
      seqExpectation: liveSnapshot.activeHand?.handSeq ?? 0,
      idempotencyKey: "history-alpha-fold-1",
      actionType: "FOLD"
    });

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/rooms/${room.room.roomId}/hands`,
      headers: { cookie: adminCookieHeader }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      items: [
        {
          roomId: room.room.roomId,
          handNumber: expect.any(Number),
          totalPot: 150
        }
      ],
      nextCursor: null
    });

    const handId = listResponse.json().items[0]?.handId as string;

    const transcriptResponse = await app.inject({
      method: "GET",
      url: `/api/hands/${handId}`,
      headers: { cookie: adminCookieHeader }
    });

    expect(transcriptResponse.statusCode).toBe(200);
    expect(transcriptResponse.json()).toMatchObject({
      handId,
      roomId: room.room.roomId,
      settlement: {
        awardedByFold: true,
        totalPot: 150
      },
      ledgerEntries: [
        {
          type: "HAND_PAYOUT",
          delta: 150
        }
      ]
    });

    const exportJsonResponse = await app.inject({
      method: "GET",
      url: `/api/hands/${handId}/export.json`,
      headers: { cookie: adminCookieHeader }
    });

    expect(exportJsonResponse.statusCode).toBe(200);
    expect(exportJsonResponse.json().handId).toBe(handId);

    const exportTextResponse = await app.inject({
      method: "GET",
      url: `/api/hands/${handId}/export.txt`,
      headers: { cookie: adminCookieHeader }
    });

    expect(exportTextResponse.statusCode).toBe(200);
    expect(exportTextResponse.body).toContain("PotLuck Hand Transcript");
    expect(exportTextResponse.body).toContain(handId);
  });

  it("leaves the seat unchanged when ledger commit fails", async () => {
    const failingState = createAppState({
      onLedgerEntryCommitted() {
        throw new Error("ledger write failed");
      }
    });
    const failingApp = buildServer({
      env: {
        NODE_ENV: "test",
        PORT: "3001",
        APP_ORIGIN: "http://localhost:3000",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/potluck?sslmode=require",
        DIRECT_DATABASE_URL: "postgresql://user:pass@localhost:5432/potluck?sslmode=require",
        SESSION_SIGNING_SECRET: "session-session-session-session-session",
        GUEST_SESSION_SIGNING_SECRET: "guest-guest-guest-guest-guest-guest",
        ADMIN_OTP_SIGNING_SECRET: "otp-otp-otp-otp-otp-otp-otp-otp-otp",
        COOKIE_SECRET: "cookie-cookie-cookie-cookie-cookie-cookie",
        RESEND_API_KEY: "re_dummy_resend_api_key",
        RESEND_FROM_EMAIL: "PotLuck Sandbox <onboarding@resend.dev>",
        REDIS_URL: "redis://default:dummy-password@localhost:6379",
        SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
        SENTRY_AUTH_TOKEN: "sntrys_dummy_auth_token",
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp-gateway-prod-us-central-0.grafana.net/otlp",
        OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic ZHVtbXktaW5zdGFuY2U6ZHVtbXktdG9rZW4="
      },
      emailAdapter,
      state: failingState
    });

    await failingApp.ready();

    try {
      const adminCookieHeader = await createAdminCookieHeader(
        `host-${Date.now()}-rollback@example.com`,
        failingApp
      );
      const room = await createRoom(adminCookieHeader, {}, failingApp);
      const guest = await joinRoom(room.room.code, "RollbackHero", "PLAYER", failingApp);

      const reserveResponse = await reserveSeat(
        room.room.roomId,
        0,
        guest.cookieHeader,
        failingApp
      );
      expect(reserveResponse.statusCode).toBe(200);

      const buyInFailure = await commitBuyIn(
        room.room.roomId,
        0,
        5000,
        guest.cookieHeader,
        "rollbackhero-buyin-1",
        failingApp
      );

      expect(buyInFailure.statusCode).toBe(503);
      expect(buyInFailure.json()).toMatchObject({
        error: {
          code: "ERR_LEDGER_COMMIT_FAILED"
        }
      });

      const lobbyResponse = await failingApp.inject({
        method: "GET",
        url: `/api/rooms/${room.room.roomId}/lobby`,
        headers: { cookie: guest.cookieHeader }
      });

      expect(lobbyResponse.statusCode).toBe(200);
      const reservedSeat = lobbyResponse
        .json()
        .seats.find((seat: { seatIndex: number }) => seat.seatIndex === 0);

      expect(reservedSeat).toMatchObject({
        seatIndex: 0,
        status: "RESERVED"
      });
      expect("stack" in reservedSeat).toBe(false);
    } finally {
      await failingApp.close();
    }
  });

  it("pauses the room and keeps payouts hidden when settlement commit fails", async () => {
    const failingState = createAppState({
      onLedgerEntriesCommitted(entries) {
        if (entries.some((entry) => entry.type === "HAND_PAYOUT" || entry.type === "RAKE")) {
          throw new Error("settlement write failed");
        }
      }
    });
    const failingApp = buildServer({
      env: {
        NODE_ENV: "test",
        PORT: "3001",
        APP_ORIGIN: "http://localhost:3000",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/potluck?sslmode=require",
        DIRECT_DATABASE_URL: "postgresql://user:pass@localhost:5432/potluck?sslmode=require",
        SESSION_SIGNING_SECRET: "session-session-session-session-session",
        GUEST_SESSION_SIGNING_SECRET: "guest-guest-guest-guest-guest-guest",
        ADMIN_OTP_SIGNING_SECRET: "otp-otp-otp-otp-otp-otp-otp-otp-otp",
        COOKIE_SECRET: "cookie-cookie-cookie-cookie-cookie-cookie",
        RESEND_API_KEY: "re_dummy_resend_api_key",
        RESEND_FROM_EMAIL: "PotLuck Sandbox <onboarding@resend.dev>",
        REDIS_URL: "redis://default:dummy-password@localhost:6379",
        SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
        SENTRY_AUTH_TOKEN: "sntrys_dummy_auth_token",
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp-gateway-prod-us-central-0.grafana.net/otlp",
        OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic ZHVtbXktaW5zdGFuY2U6ZHVtbXktdG9rZW4="
      },
      emailAdapter,
      state: failingState
    });

    await failingApp.ready();

    try {
      const adminCookieHeader = await createAdminCookieHeader(
        `host-${Date.now()}-settlement@example.com`,
        failingApp
      );
      const room = await createRoom(adminCookieHeader, {}, failingApp);
      const alpha = await joinRoom(room.room.code, "AlphaPause", "PLAYER", failingApp);
      const bravo = await joinRoom(room.room.code, "BravoPause", "PLAYER", failingApp);

      await reserveSeat(room.room.roomId, 0, alpha.cookieHeader, failingApp);
      await reserveSeat(room.room.roomId, 1, bravo.cookieHeader, failingApp);
      await commitBuyIn(room.room.roomId, 0, 5000, alpha.cookieHeader, "pause-alpha-buyin-1", failingApp);
      await commitBuyIn(room.room.roomId, 1, 5000, bravo.cookieHeader, "pause-bravo-buyin-1", failingApp);

      const alphaActor = alpha.response.json().actor;
      const bravoActor = bravo.response.json().actor;

      failingState.playerReady(room.room.roomId, alphaActor, 0);
      failingState.playerReady(room.room.roomId, bravoActor, 1);

      const liveSnapshot = failingState.getRoomRealtimeSnapshot(room.room.roomId, alphaActor);

      await failingState.submitAction(room.room.roomId, alphaActor, {
        handId: liveSnapshot.activeHand?.handId ?? "",
        seqExpectation: liveSnapshot.activeHand?.handSeq ?? 0,
        idempotencyKey: "pause-alpha-fold-1",
        actionType: "FOLD"
      });

      const pausedSnapshot = failingState.getRoomRealtimeSnapshot(room.room.roomId, alphaActor);
      const winnerSeat = pausedSnapshot.seats.find((seat) => seat.seatIndex === 1);

      expect(pausedSnapshot.room.status).toBe("PAUSED");
      expect(pausedSnapshot.tablePhase).toBe("HAND_ACTIVE");
      expect(pausedSnapshot.activeHand?.handId).toBe(liveSnapshot.activeHand?.handId);
      expect(pausedSnapshot.pausedReason).toContain("Settlement could not be committed");
      expect(winnerSeat?.stack).toBe(4900);
      expect(
        failingState
          .getLedgerEntries(room.room.roomId)
          .every((entry) => entry.type !== "HAND_PAYOUT" && entry.type !== "RAKE")
      ).toBe(true);

      const historyListResponse = await failingApp.inject({
        method: "GET",
        url: `/api/rooms/${room.room.roomId}/hands`,
        headers: { cookie: adminCookieHeader }
      });

      expect(historyListResponse.statusCode).toBe(200);
      expect(historyListResponse.json()).toEqual({
        items: [],
        nextCursor: null
      });
    } finally {
      await failingApp.close();
    }
  });
});

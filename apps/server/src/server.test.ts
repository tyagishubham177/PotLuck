import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type EmailAdapter } from "./email.js";
import { buildServer } from "./server.js";

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
  emailAdapter
});

function getCookieHeader(setCookieHeaders: string[]) {
  return setCookieHeaders.map((entry) => entry.split(";")[0]).join("; ");
}

async function createAdminCookieHeader(email = `host-${Date.now()}-${Math.random()}@example.com`) {
  const requestOtpResponse = await app.inject({
    method: "POST",
    url: "/api/auth/admin/request-otp",
    payload: { email }
  });
  const otpPayload = requestOtpResponse.json();
  const sentOtp = sentOtps.at(-1);

  const verifyResponse = await app.inject({
    method: "POST",
    url: "/api/auth/admin/verify-otp",
    payload: {
      challengeId: otpPayload.challengeId,
      code: sentOtp?.code
    }
  });

  const sessionCookies = verifyResponse.headers["set-cookie"];
  return getCookieHeader(
    Array.isArray(sessionCookies) ? sessionCookies : [sessionCookies ?? ""]
  );
}

async function createRoom(adminCookieHeader: string, overrides: Record<string, unknown> = {}) {
  const response = await app.inject({
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

async function joinRoom(code: string, nickname: string, mode: "PLAYER" | "SPECTATOR" = "PLAYER") {
  const response = await app.inject({
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

describe("phase 02 room, lobby, and seating", () => {
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
});

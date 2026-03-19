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

describe("phase 01 auth and guest entry", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the baseline health payload on both health routes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "potluck-server",
      environment: "test"
    });
  });

  it("requests and verifies an admin OTP, then exposes the session", async () => {
    const requestOtpResponse = await app.inject({
      method: "POST",
      url: "/api/auth/admin/request-otp",
      payload: {
        email: "host@example.com"
      }
    });

    expect(requestOtpResponse.statusCode).toBe(200);
    const otpPayload = requestOtpResponse.json();
    const sentOtp = sentOtps.at(-1);

    expect(sentOtp?.challengeId).toBe(otpPayload.challengeId);

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/api/auth/admin/verify-otp",
      payload: {
        challengeId: otpPayload.challengeId,
        code: sentOtp?.code
      }
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json().actor.role).toBe("ADMIN");

    const sessionCookies = verifyResponse.headers["set-cookie"];
    const authSessionResponse = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      headers: {
        cookie: getCookieHeader(
          Array.isArray(sessionCookies) ? sessionCookies : [sessionCookies ?? ""]
        )
      }
    });

    expect(authSessionResponse.statusCode).toBe(200);
    expect(authSessionResponse.json()).toMatchObject({
      authenticated: true,
      actor: {
        role: "ADMIN",
        email: "host@example.com"
      }
    });
  });

  it("rejects duplicate nicknames in the same room", async () => {
    const firstJoinResponse = await app.inject({
      method: "POST",
      url: "/api/rooms/DEMO42/join",
      payload: {
        nickname: "RiverKid",
        mode: "PLAYER"
      }
    });

    expect(firstJoinResponse.statusCode).toBe(200);

    const secondJoinResponse = await app.inject({
      method: "POST",
      url: "/api/rooms/DEMO42/join",
      payload: {
        nickname: "RiverKid",
        mode: "PLAYER"
      }
    });

    expect(secondJoinResponse.statusCode).toBe(409);
    expect(secondJoinResponse.json()).toMatchObject({
      error: {
        code: "ERR_JOIN_NAME_CONFLICT"
      }
    });
  });

  it("returns typed not-found errors for expired room codes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/rooms/SUNSET"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: {
        code: "ERR_ROOM_NOT_FOUND"
      }
    });
  });

  it("refreshes and logs out a guest session", async () => {
    const joinResponse = await app.inject({
      method: "POST",
      url: "/api/rooms/DEMO42/join",
      payload: {
        nickname: "SpectateSam",
        mode: "SPECTATOR"
      }
    });
    const sessionCookies = joinResponse.headers["set-cookie"];
    const cookieHeader = getCookieHeader(
      Array.isArray(sessionCookies) ? sessionCookies : [sessionCookies ?? ""]
    );

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: {
        cookie: cookieHeader
      }
    });

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json()).toMatchObject({
      actor: {
        role: "GUEST",
        nickname: "SpectateSam"
      }
    });

    const refreshedCookieHeader = getCookieHeader(
      Array.isArray(refreshResponse.headers["set-cookie"])
        ? refreshResponse.headers["set-cookie"]
        : [refreshResponse.headers["set-cookie"] ?? ""]
    );

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        cookie: refreshedCookieHeader
      }
    });

    expect(logoutResponse.statusCode).toBe(200);
    expect(logoutResponse.json()).toEqual({
      success: true
    });
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

describe("server health route", () => {
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
    }
  });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the baseline health payload", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "potluck-server",
      environment: "test"
    });
  });
});

import { describe, expect, it } from "vitest";

import { getServerEnv } from "../src/server.js";
import { getWebEnv } from "../src/web.js";

describe("config schemas", () => {
  it("parses server env", () => {
    const env = getServerEnv({
      NODE_ENV: "development",
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
    });

    expect(env.PORT).toBe(3001);
  });

  it("parses web env", () => {
    const env = getWebEnv({
      NEXT_PUBLIC_APP_NAME: "PotLuck",
      NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000",
      NEXT_PUBLIC_SERVER_ORIGIN: "http://localhost:3001",
      NEXT_PUBLIC_ENV_NAME: "local",
      NEXT_PUBLIC_SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0"
    });

    expect(env.NEXT_PUBLIC_SERVER_ORIGIN).toBe("http://localhost:3001");
  });
});

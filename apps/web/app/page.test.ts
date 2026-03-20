import { describe, expect, it } from "vitest";

import { getHomePageConfig } from "./lib/page-config";

describe("page config", () => {
  it("builds the public home page config from env", () => {
    const config = getHomePageConfig({
      NEXT_PUBLIC_APP_NAME: "PotLuck",
      NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000",
      NEXT_PUBLIC_SERVER_ORIGIN: "http://localhost:3001",
      NEXT_PUBLIC_ENV_NAME: "test",
      NEXT_PUBLIC_SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0"
    });

    expect(config).toMatchObject({
      appName: "PotLuck",
      appOrigin: "http://localhost:3000",
      serverOrigin: "http://localhost:3001",
      envName: "test",
      statusLabel: "phase-09-ready"
    });
  });

  it("raises a clearer error when required env is missing", () => {
    expect(() =>
      getHomePageConfig({
        NEXT_PUBLIC_APP_NAME: "PotLuck",
        NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000",
        NEXT_PUBLIC_SERVER_ORIGIN: "not-a-url",
        NEXT_PUBLIC_ENV_NAME: "test",
        NEXT_PUBLIC_SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0"
      })
    ).toThrow(/Public web configuration is invalid/i);
  });
});

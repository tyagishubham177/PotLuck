import { describe, expect, it } from "vitest";

import { getWebEnv } from "@potluck/config/web";

describe("web env", () => {
  it("loads the public app name", () => {
    const env = getWebEnv({
      NEXT_PUBLIC_APP_NAME: "PotLuck",
      NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000",
      NEXT_PUBLIC_SERVER_ORIGIN: "http://localhost:3001",
      NEXT_PUBLIC_ENV_NAME: "test",
      NEXT_PUBLIC_SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0"
    });

    expect(env.NEXT_PUBLIC_APP_NAME).toBe("PotLuck");
  });
});

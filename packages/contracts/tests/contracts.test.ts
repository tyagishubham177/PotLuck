import { describe, expect, it } from "vitest";

import { healthResponseSchema } from "../src/index.js";

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
});

import { describe, expect, it } from "vitest";

import { createClientSnapshotFixture } from "../src/index.js";

describe("test kit fixture", () => {
  it("creates a contract-valid client snapshot", () => {
    const fixture = createClientSnapshotFixture();

    expect(fixture.status).toBe("foundation-ready");
  });
});

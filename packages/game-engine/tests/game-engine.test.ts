import { describe, expect, it } from "vitest";

import { createEnginePlaceholder } from "../src/index.js";

describe("game engine placeholder", () => {
  it("declares holdem support without implementing rules yet", () => {
    const engine = createEnginePlaceholder();

    expect(engine.supportedVariants).toEqual(["holdem"]);
  });
});

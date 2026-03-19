import { describe, expect, it } from "vitest";

import {
  createClientSnapshotFixture,
  createLedgerEntryFixture,
  createRoomBalanceSummaryFixture,
  createRoomRealtimeSnapshotFixture
} from "../src/index.js";

describe("test kit fixture", () => {
  it("creates a contract-valid client snapshot", () => {
    const fixture = createClientSnapshotFixture();

    expect(fixture.status).toBe("foundation-ready");
  });

  it("creates ledger fixtures for chip-accounting tests", () => {
    const ledgerEntry = createLedgerEntryFixture();
    const balance = createRoomBalanceSummaryFixture();

    expect(ledgerEntry.type).toBe("BUY_IN");
    expect(balance.netBalance).toBe(5000);
  });

  it("creates a realtime room snapshot fixture", () => {
    const snapshot = createRoomRealtimeSnapshotFixture();

    expect(snapshot.roomEventNo).toBe(4);
    expect(snapshot.participants[0]?.isReady).toBe(true);
  });
});

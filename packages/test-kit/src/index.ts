import {
  clientSnapshotSchema,
  ledgerEntrySchema,
  roomBalanceSummarySchema
} from "@potluck/contracts";

export function createClientSnapshotFixture() {
  return clientSnapshotSchema.parse({
    appName: "PotLuck",
    appOrigin: "http://localhost:3000",
    serverOrigin: "http://localhost:3001",
    status: "foundation-ready"
  });
}

export function createLedgerEntryFixture() {
  return ledgerEntrySchema.parse({
    entryId: "ledger_fixture_001",
    roomId: "room_fixture_001",
    participantId: "guest_fixture_001",
    seatIndex: 0,
    type: "BUY_IN",
    delta: 5000,
    balanceAfter: 5000,
    referenceId: "op_fixture_001",
    idempotencyKey: "fixture-buyin-1",
    createdAt: "2026-03-19T12:00:00.000Z"
  });
}

export function createRoomBalanceSummaryFixture() {
  return roomBalanceSummarySchema.parse({
    roomId: "room_fixture_001",
    participantId: "guest_fixture_001",
    seatIndex: 0,
    buyInCommitted: 5000,
    rebuyCommitted: 0,
    topUpCommitted: 0,
    adjustmentTotal: 0,
    totalCommitted: 5000,
    netBalance: 5000,
    liveStack: 5000
  });
}

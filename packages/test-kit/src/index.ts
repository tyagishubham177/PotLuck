import {
  clientSnapshotSchema,
  ledgerEntrySchema,
  roomBalanceSummarySchema,
  roomRealtimeSnapshotSchema
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

export function createRoomRealtimeSnapshotFixture() {
  return roomRealtimeSnapshotSchema.parse({
    room: {
      roomId: "room_fixture_001",
      code: "FIXED1",
      tableName: "Fixture Table",
      status: "OPEN",
      maxSeats: 2,
      openSeatCount: 0,
      reservedSeatCount: 0,
      occupiedSeatCount: 2,
      participantCount: 2,
      queuedCount: 0,
      spectatorsAllowed: true,
      waitingListEnabled: true,
      joinCodeExpiresAt: "2026-03-19T14:00:00.000Z",
      createdAt: "2026-03-19T12:00:00.000Z",
      closesAt: "2026-03-20T00:00:00.000Z"
    },
    config: {
      tableName: "Fixture Table",
      maxSeats: 2,
      variant: "HOLD_EM_NL",
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      buyInMode: "BB_MULTIPLE",
      minBuyIn: 40,
      maxBuyIn: 250,
      rakeEnabled: false,
      rakePercent: 0,
      rakeCap: 0,
      oddChipRule: "LEFT_OF_BUTTON",
      spectatorsAllowed: true,
      straddleAllowed: false,
      rebuyEnabled: true,
      topUpEnabled: true,
      seatReservationTimeoutSeconds: 120,
      joinCodeExpiryMinutes: 120,
      waitingListEnabled: true,
      roomMaxDurationMinutes: 720
    },
    seats: [
      {
        seatIndex: 0,
        status: "OCCUPIED",
        participantId: "guest_fixture_001",
        nickname: "Alpha",
        stack: 5000
      },
      {
        seatIndex: 1,
        status: "OCCUPIED",
        participantId: "guest_fixture_002",
        nickname: "Bravo",
        stack: 5000
      }
    ],
    waitingList: [],
    participants: [
      {
        participantId: "guest_fixture_001",
        nickname: "Alpha",
        mode: "PLAYER",
        state: "SEATED",
        joinedAt: "2026-03-19T12:00:00.000Z",
        isConnected: true,
        seatIndex: 0,
        isReady: true,
        isSittingOut: false
      },
      {
        participantId: "guest_fixture_002",
        nickname: "Bravo",
        mode: "PLAYER",
        state: "SEATED",
        joinedAt: "2026-03-19T12:00:10.000Z",
        isConnected: true,
        seatIndex: 1,
        isReady: false,
        isSittingOut: false
      }
    ],
    buyInQuote: {
      roomId: "room_fixture_001",
      mode: "BB_MULTIPLE",
      minUnits: 40,
      maxUnits: 250,
      minChips: 4000,
      maxChips: 25000,
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      displayMin: "40 BB = 4,000 chips",
      displayMax: "250 BB = 25,000 chips"
    },
    heroParticipantId: "guest_fixture_001",
    heroSeatIndex: 0,
    canJoinWaitingList: false,
    tablePhase: "BETWEEN_HANDS",
    roomEventNo: 4,
    activeHand: null
  });
}

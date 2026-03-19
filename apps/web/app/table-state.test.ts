import { describe, expect, it } from "vitest";

import type { RoomPrivateState, RoomRealtimeSnapshot } from "@potluck/contracts";

import {
  buildSeatViewModels,
  clampActionAmount,
  getActionTrayState,
  getDefaultActionAmount
} from "./table-state";

const snapshot: RoomRealtimeSnapshot = {
  room: {
    roomId: "room_123",
    code: "DEMO42",
    tableName: "Realtime Table",
    status: "OPEN",
    joinLocked: false,
    maxSeats: 6,
    openSeatCount: 4,
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
    tableName: "Realtime Table",
    maxSeats: 6,
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
      participantId: "guest_alpha",
      nickname: "Alpha",
      stack: 3200
    },
    {
      seatIndex: 1,
      status: "OCCUPIED",
      participantId: "guest_bravo",
      nickname: "Bravo",
      stack: 6100
    },
    {
      seatIndex: 2,
      status: "EMPTY"
    },
    {
      seatIndex: 3,
      status: "EMPTY"
    },
    {
      seatIndex: 4,
      status: "EMPTY"
    },
    {
      seatIndex: 5,
      status: "EMPTY"
    }
  ],
  waitingList: [],
  participants: [
    {
      participantId: "guest_alpha",
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
      participantId: "guest_bravo",
      nickname: "Bravo",
      mode: "PLAYER",
      state: "SEATED",
      joinedAt: "2026-03-19T12:01:00.000Z",
      isConnected: false,
      seatIndex: 1,
      isReady: false,
      isSittingOut: false,
      lastDisconnectedAt: "2026-03-19T12:06:00.000Z",
      reconnectGraceEndsAt: "2026-03-19T12:08:00.000Z"
    }
  ],
  buyInQuote: {
    roomId: "room_123",
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
  heroParticipantId: "guest_alpha",
  heroSeatIndex: 0,
  canJoinWaitingList: false,
  tablePhase: "HAND_ACTIVE",
  roomEventNo: 7,
  activeHand: {
    handId: "hand_001",
    handNumber: 1,
    handSeq: 4,
    street: "TURN",
    buttonSeatIndex: 0,
    smallBlindSeatIndex: 0,
    bigBlindSeatIndex: 1,
    actingSeatIndex: 0,
    eligibleSeatOrder: [0, 1],
    foldedSeatIndexes: [],
    actedSeatIndexes: [1],
    board: ["AS", "KH", "QD", "JC"],
    potTotal: 700,
    currentBet: 400,
    minimumRaiseTo: 800,
    showdownSeatIndexes: [],
    showdownRevealOrder: [],
    players: [
      {
        seatIndex: 0,
        participantId: "guest_alpha",
        status: "ACTIVE",
        stack: 3200,
        streetCommitted: 200,
        totalCommitted: 800,
        hasActed: false,
        canRaise: true
      },
      {
        seatIndex: 1,
        participantId: "guest_bravo",
        status: "ALL_IN",
        stack: 0,
        streetCommitted: 400,
        totalCommitted: 1800,
        hasActed: true,
        canRaise: false
      }
    ],
    forcedCommitments: [
      {
        seatIndex: 0,
        participantId: "guest_alpha",
        type: "SMALL_BLIND",
        amount: 50
      },
      {
        seatIndex: 1,
        participantId: "guest_bravo",
        type: "BIG_BLIND",
        amount: 100
      }
    ],
    startedAt: "2026-03-19T12:05:00.000Z",
    deadlineAt: "2026-03-19T12:07:30.000Z"
  },
  pausedReason: null
};

const privateState: RoomPrivateState = {
  roomId: "room_123",
  participantId: "guest_alpha",
  roomEventNo: 7,
  seatIndex: 0,
  stack: 3200,
  holeCards: ["AH", "AD"],
  actionAffordances: {
    canFold: true,
    canCheck: false,
    callAmount: 200,
    minRaiseTo: 800,
    maxRaiseTo: 3200,
    allInAmount: 3200,
    presetAmounts: [800, 1200, 1800, 3200]
  },
  reconnect: {
    isReconnecting: false
  }
};

describe("table state helpers", () => {
  it("derives only legal quick actions and sizing controls", () => {
    const tray = getActionTrayState(snapshot.activeHand, privateState.actionAffordances);

    expect(tray.quickActions.map((action) => action.actionType)).toEqual([
      "FOLD",
      "CALL",
      "ALL_IN"
    ]);
    expect(tray.sizingAction).toMatchObject({
      actionType: "RAISE",
      min: 800,
      max: 3200,
      presets: [800, 1200, 1800, 3200]
    });
  });

  it("uses the first valid preset as the default amount and clamps inputs to legal bounds", () => {
    expect(getDefaultActionAmount(privateState.actionAffordances)).toBe("800");
    expect(clampActionAmount(10, privateState.actionAffordances)).toBe(800);
    expect(clampActionAmount(9999, privateState.actionAffordances)).toBe(3200);
  });

  it("builds seat cards with acting, hero, and disconnect state", () => {
    const seats = buildSeatViewModels(
      snapshot,
      privateState,
      new Date("2026-03-19T12:07:00.000Z").getTime()
    );

    expect(seats[0]).toMatchObject({
      isHero: true,
      isActing: true,
      badgeLabel: "D",
      hasPrivateCards: true,
      statusTone: "hero"
    });
    expect(seats[0].timerLabel).toBe("30s");
    expect(seats[1]).toMatchObject({
      isAllIn: true,
      isDisconnected: true,
      statusTone: "occupied"
    });
  });
});

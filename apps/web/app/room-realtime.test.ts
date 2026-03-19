import { describe, expect, it } from "vitest";

import type { RoomRealtimeSnapshot } from "@potluck/contracts";

import { applyRoomDiff, toWebSocketUrl } from "./room-realtime";

describe("room realtime helpers", () => {
  it("derives a websocket url from the server origin", () => {
    expect(toWebSocketUrl("http://localhost:3001")).toBe("ws://localhost:3001/ws");
    expect(toWebSocketUrl("https://potluck.example.com")).toBe(
      "wss://potluck.example.com/ws"
    );
  });

  it("applies only newer room diff payloads", () => {
    const current: RoomRealtimeSnapshot = {
      room: {
        roomId: "room_123",
        code: "DEMO42",
        tableName: "Realtime Table",
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
        tableName: "Realtime Table",
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
          participantId: "guest_alpha",
          nickname: "Alpha",
          stack: 5000
        },
        {
          seatIndex: 1,
          status: "OCCUPIED",
          participantId: "guest_bravo",
          nickname: "Bravo",
          stack: 5000
        }
      ],
      waitingList: [],
      participants: [
        {
          participantId: "guest_alpha",
          nickname: "Alpha",
          mode: "PLAYER",
          state: "SEATED",
          joinedAt: "2026-03-19T12:01:00.000Z",
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
          joinedAt: "2026-03-19T12:01:30.000Z",
          isConnected: true,
          seatIndex: 1,
          isReady: false,
          isSittingOut: false
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
      tablePhase: "BETWEEN_HANDS",
      roomEventNo: 4,
      activeHand: null
    };

    const unchanged = applyRoomDiff(
      current,
      {
        tablePhase: "HAND_ACTIVE"
      },
      4
    );

    expect(unchanged).toEqual(current);

    const updated = applyRoomDiff(
      current,
      {
        tablePhase: "HAND_ACTIVE",
        activeHand: {
          handId: "hand_001",
          handNumber: 1,
          handSeq: 0,
          actingSeatIndex: 0,
          eligibleSeatOrder: [0, 1],
          foldedSeatIndexes: [],
          actedSeatIndexes: [],
          startedAt: "2026-03-19T12:05:00.000Z",
          deadlineAt: "2026-03-19T12:05:15.000Z"
        }
      },
      5
    );

    expect(updated.roomEventNo).toBe(5);
    expect(updated.tablePhase).toBe("HAND_ACTIVE");
    expect(updated.activeHand?.handId).toBe("hand_001");
  });
});

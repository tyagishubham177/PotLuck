import { describe, expect, it } from "vitest";

import type { RoomRealtimeSnapshot } from "@potluck/contracts";

import {
  applyRoomDiff,
  createAuthStateSyncMarker,
  shouldRefreshAuthStateFromSyncMarker,
  shouldResetRoomState,
  toWebSocketUrl
} from "./room-realtime";

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
        joinLocked: false,
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
          street: "PREFLOP",
          buttonSeatIndex: 0,
          smallBlindSeatIndex: 0,
          bigBlindSeatIndex: 1,
          actingSeatIndex: 0,
          eligibleSeatOrder: [0, 1],
          foldedSeatIndexes: [],
          actedSeatIndexes: [],
          board: [],
          potTotal: 150,
          currentBet: 100,
          minimumRaiseTo: 200,
          showdownSeatIndexes: [],
          showdownRevealOrder: [],
          players: [
            {
              seatIndex: 0,
              participantId: "guest_alpha",
              status: "ACTIVE",
              stack: 4950,
              streetCommitted: 50,
              totalCommitted: 50,
              hasActed: false,
              canRaise: true
            },
            {
              seatIndex: 1,
              participantId: "guest_bravo",
              status: "ACTIVE",
              stack: 4900,
              streetCommitted: 100,
              totalCommitted: 100,
              hasActed: false,
              canRaise: true
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
          deadlineAt: "2026-03-19T12:05:15.000Z"
        }
      },
      5
    );

    expect(updated.roomEventNo).toBe(5);
    expect(updated.tablePhase).toBe("HAND_ACTIVE");
    expect(updated.activeHand?.handId).toBe("hand_001");
  });

  it("resets room state when the guest room scope changes", () => {
    expect(
      shouldResetRoomState(
        {
          session: {
            sessionId: "session_guest_1",
            role: "GUEST",
            issuedAt: "2026-03-19T12:00:00.000Z",
            expiresAt: "2026-03-19T12:15:00.000Z",
            refreshExpiresAt: "2026-03-26T12:00:00.000Z"
          },
          actor: {
            role: "GUEST",
            guestId: "guest_alpha",
            nickname: "Alpha",
            mode: "PLAYER",
            roomId: "room_123",
            roomCode: "DEMO42"
          }
        },
        {
          session: {
            sessionId: "session_guest_2",
            role: "GUEST",
            issuedAt: "2026-03-19T12:05:00.000Z",
            expiresAt: "2026-03-19T12:20:00.000Z",
            refreshExpiresAt: "2026-03-26T12:05:00.000Z"
          },
          actor: {
            role: "GUEST",
            guestId: "guest_bravo",
            nickname: "Bravo",
            mode: "PLAYER",
            roomId: "room_456",
            roomCode: "TABLE2"
          }
        }
      )
    ).toBe(true);

    expect(
      shouldResetRoomState(
        {
          session: {
            sessionId: "session_guest_1",
            role: "GUEST",
            issuedAt: "2026-03-19T12:00:00.000Z",
            expiresAt: "2026-03-19T12:15:00.000Z",
            refreshExpiresAt: "2026-03-26T12:00:00.000Z"
          },
          actor: {
            role: "GUEST",
            guestId: "guest_alpha",
            nickname: "Alpha",
            mode: "PLAYER",
            roomId: "room_123",
            roomCode: "DEMO42"
          }
        },
        {
          session: {
            sessionId: "session_guest_2",
            role: "GUEST",
            issuedAt: "2026-03-19T12:05:00.000Z",
            expiresAt: "2026-03-19T12:20:00.000Z",
            refreshExpiresAt: "2026-03-26T12:05:00.000Z"
          },
          actor: {
            role: "GUEST",
            guestId: "guest_alpha",
            nickname: "Alpha",
            mode: "PLAYER",
            roomId: "room_123",
            roomCode: "DEMO42"
          }
        }
      )
    ).toBe(false);
  });

  it("creates sync markers that ignore same-scope guest refreshes", () => {
    const authState = {
      session: {
        sessionId: "session_guest_1",
        role: "GUEST" as const,
        issuedAt: "2026-03-19T12:00:00.000Z",
        expiresAt: "2026-03-19T12:15:00.000Z",
        refreshExpiresAt: "2026-03-26T12:00:00.000Z"
      },
      actor: {
        role: "GUEST" as const,
        guestId: "guest_alpha",
        nickname: "Alpha",
        mode: "PLAYER" as const,
        roomId: "room_123",
        roomCode: "DEMO42"
      }
    };

    expect(
      shouldRefreshAuthStateFromSyncMarker(authState, createAuthStateSyncMarker(authState, 1))
    ).toBe(false);

    expect(
      shouldRefreshAuthStateFromSyncMarker(
        authState,
        createAuthStateSyncMarker({
          session: {
            sessionId: "session_guest_2",
            role: "GUEST",
            issuedAt: "2026-03-19T12:05:00.000Z",
            expiresAt: "2026-03-19T12:20:00.000Z",
            refreshExpiresAt: "2026-03-26T12:05:00.000Z"
          },
          actor: {
            role: "GUEST",
            guestId: "guest_bravo",
            nickname: "Bravo",
            mode: "PLAYER",
            roomId: "room_123",
            roomCode: "DEMO42"
          }
        })
      )
    ).toBe(true);
  });

  it("refreshes auth state when the sync marker is malformed", () => {
    expect(shouldRefreshAuthStateFromSyncMarker(null, "not-json")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import {
  HoldemEngineError,
  applyHoldemAction,
  createEngineMetadata,
  createShuffledDeck,
  getLegalActions,
  startHoldemHand
} from "../src/index.js";

function buildDeck(prefix: string[]) {
  const remainder = createShuffledDeck("game-engine-test-seed").filter(
    (card) => !prefix.includes(card)
  );

  return [...prefix, ...remainder];
}

describe("holdem engine", () => {
  it("publishes real engine metadata", () => {
    expect(createEngineMetadata()).toEqual({
      name: "holdem-engine-v1",
      supportedVariants: ["holdem"]
    });
  });

  it("applies the correct heads-up blind positions and first action", () => {
    const state = startHoldemHand({
      handId: "hand_heads_up",
      handNumber: 1,
      previousButtonSeatIndex: 1,
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      players: [
        { seatIndex: 0, participantId: "alpha", stack: 1000 },
        { seatIndex: 1, participantId: "bravo", stack: 1000 }
      ],
      deck: buildDeck(["AS", "KH", "QD", "JC", "TC", "9C", "8D", "7D", "6H"])
    });

    expect(state.buttonSeatIndex).toBe(0);
    expect(state.smallBlindSeatIndex).toBe(0);
    expect(state.bigBlindSeatIndex).toBe(1);
    expect(state.actingSeatIndex).toBe(0);
    expect(state.currentBet).toBe(100);
    expect(state.minimumRaiseTo).toBe(200);
    expect(state.potTotal).toBe(150);
    expect(state.board).toEqual([]);
    expect(state.players[0]?.holeCards).toEqual(["AS", "QD"]);
    expect(state.players[1]?.holeCards).toEqual(["KH", "JC"]);

    expect(getLegalActions(state, 0)).toMatchObject({
      canFold: true,
      canCheck: false,
      callAmount: 50,
      minRaiseTo: 200,
      maxRaiseTo: 1000,
      allInAmount: 1000
    });
  });

  it("rejects raises below the minimum full raise target", () => {
    const state = startHoldemHand({
      handId: "hand_min_raise",
      handNumber: 2,
      previousButtonSeatIndex: 1,
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      players: [
        { seatIndex: 0, participantId: "alpha", stack: 1000 },
        { seatIndex: 1, participantId: "bravo", stack: 1000 }
      ]
    });

    expect(() =>
      applyHoldemAction(state, {
        seatIndex: 0,
        actionType: "RAISE",
        amount: 150
      })
    ).toThrowError(HoldemEngineError);

    try {
      applyHoldemAction(state, {
        seatIndex: 0,
        actionType: "RAISE",
        amount: 150
      });
    } catch (error) {
      expect(error).toBeInstanceOf(HoldemEngineError);
      expect((error as HoldemEngineError).code).toBe("ERR_MIN_RAISE");
    }
  });

  it("keeps raises closed for players who already acted after a short all-in", () => {
    const state = startHoldemHand({
      handId: "hand_short_all_in",
      handNumber: 3,
      previousButtonSeatIndex: 2,
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      players: [
        { seatIndex: 0, participantId: "alpha", stack: 1000 },
        { seatIndex: 1, participantId: "bravo", stack: 150 },
        { seatIndex: 2, participantId: "charlie", stack: 1000 }
      ]
    });

    const firstCall = applyHoldemAction(state, {
      seatIndex: 0,
      actionType: "CALL"
    });
    const shortAllIn = applyHoldemAction(firstCall.state, {
      seatIndex: 1,
      actionType: "ALL_IN"
    });

    expect(shortAllIn.state.currentBet).toBe(150);
    expect(getLegalActions(shortAllIn.state, 2)).toMatchObject({
      callAmount: 50,
      minRaiseTo: 200
    });

    const bigBlindCall = applyHoldemAction(shortAllIn.state, {
      seatIndex: 2,
      actionType: "CALL"
    });
    const underTheGunOptions = getLegalActions(bigBlindCall.state, 0);

    expect(underTheGunOptions).toMatchObject({
      canFold: true,
      canCheck: false,
      callAmount: 50,
      minRaiseTo: undefined,
      maxRaiseTo: undefined
    });
  });

  it("auto-deals the remaining board when everyone is all-in", () => {
    const state = startHoldemHand({
      handId: "hand_auto_deal",
      handNumber: 4,
      previousButtonSeatIndex: 1,
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      players: [
        { seatIndex: 0, participantId: "alpha", stack: 1000 },
        { seatIndex: 1, participantId: "bravo", stack: 1000 }
      ],
      deck: buildDeck(["AS", "KS", "QH", "JH", "TD", "9D", "8C", "7C", "6S"])
    });

    const opener = applyHoldemAction(state, {
      seatIndex: 0,
      actionType: "ALL_IN"
    });
    const caller = applyHoldemAction(opener.state, {
      seatIndex: 1,
      actionType: "ALL_IN"
    });

    expect(caller.state.handStatus).toBe("SHOWDOWN_PENDING");
    expect(caller.state.street).toBe("SHOWDOWN");
    expect(caller.state.board).toHaveLength(5);
    expect(caller.state.actingSeatIndex).toBeUndefined();
    expect(caller.effects.map((effect) => effect.type)).toEqual([
      "STREET_ADVANCED",
      "STREET_ADVANCED",
      "STREET_ADVANCED",
      "SHOWDOWN_TRIGGERED"
    ]);
  });

  it("awards the hand immediately when everyone else folds", () => {
    const state = startHoldemHand({
      handId: "hand_fold_win",
      handNumber: 5,
      previousButtonSeatIndex: 1,
      smallBlind: 50,
      bigBlind: 100,
      ante: 0,
      players: [
        { seatIndex: 0, participantId: "alpha", stack: 1000 },
        { seatIndex: 1, participantId: "bravo", stack: 1000 }
      ]
    });

    const folded = applyHoldemAction(state, {
      seatIndex: 0,
      actionType: "FOLD"
    });

    expect(folded.state.handStatus).toBe("AWARDED");
    expect(folded.state.winnerByFoldSeatIndex).toBe(1);
    expect(folded.effects).toEqual([
      {
        type: "HAND_AWARDED",
        winningSeatIndex: 1,
        potTotal: 150
      }
    ]);
  });
});

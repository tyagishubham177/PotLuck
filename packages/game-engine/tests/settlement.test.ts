import { describe, expect, it } from "vitest";

import { settleHoldemHand, type HoldemSettlementInput, type HoldemSettlementPlayerState } from "../src/index.js";

function createPlayer(
  overrides: Partial<HoldemSettlementPlayerState> & {
    seatIndex: number;
    participantId: string;
    startingStack: number;
    stack: number;
    holeCards: [string, string];
    totalCommitted: number;
  }
): HoldemSettlementPlayerState {
  return {
    seatIndex: overrides.seatIndex,
    participantId: overrides.participantId,
    startingStack: overrides.startingStack,
    stack: overrides.stack,
    status: overrides.status ?? "ACTIVE",
    holeCards: overrides.holeCards,
    totalCommitted: overrides.totalCommitted,
    contributedByStreet: overrides.contributedByStreet ?? {
      PREFLOP: overrides.totalCommitted,
      FLOP: 0,
      TURN: 0,
      RIVER: 0
    }
  };
}

function createSettlementInput(
  overrides: Partial<HoldemSettlementInput> & {
    handId: string;
    handNumber: number;
    seatOrder: number[];
    potTotal: number;
    board: string[];
    players: HoldemSettlementPlayerState[];
  }
): HoldemSettlementInput {
  return {
    handId: overrides.handId,
    handNumber: overrides.handNumber,
    buttonSeatIndex: overrides.buttonSeatIndex,
    smallBlindSeatIndex: overrides.smallBlindSeatIndex,
    bigBlindSeatIndex: overrides.bigBlindSeatIndex,
    potTotal: overrides.potTotal,
    board: overrides.board,
    seatOrder: overrides.seatOrder,
    players: overrides.players,
    actionLog: overrides.actionLog ?? [],
    forcedCommitments: overrides.forcedCommitments ?? [],
    winnerByFoldSeatIndex: overrides.winnerByFoldSeatIndex
  };
}

describe("holdem settlement", () => {
  it("builds deterministic side pots and awards for the four-way all-in example", () => {
    const settlement = settleHoldemHand(
      createSettlementInput({
        handId: "hand_side_pots",
        handNumber: 12,
        buttonSeatIndex: 0,
        potTotal: 570,
        seatOrder: [0, 1, 2, 3],
        board: ["AH", "KC", "QD", "JD", "2S"],
        players: [
          createPlayer({
            seatIndex: 0,
            participantId: "ava",
            startingStack: 50,
            stack: 0,
            status: "ALL_IN",
            holeCards: ["AC", "7C"],
            totalCommitted: 50
          }),
          createPlayer({
            seatIndex: 1,
            participantId: "ben",
            startingStack: 120,
            stack: 0,
            status: "ALL_IN",
            holeCards: ["TC", "9C"],
            totalCommitted: 120
          }),
          createPlayer({
            seatIndex: 2,
            participantId: "cy",
            startingStack: 300,
            stack: 100,
            status: "ACTIVE",
            holeCards: ["TS", "9S"],
            totalCommitted: 200
          }),
          createPlayer({
            seatIndex: 3,
            participantId: "dia",
            startingStack: 300,
            stack: 100,
            status: "ACTIVE",
            holeCards: ["KH", "2H"],
            totalCommitted: 200
          })
        ]
      })
    );

    expect(settlement.pots).toEqual([
      {
        potIndex: 0,
        potType: "MAIN",
        capLevel: 50,
        amount: 200,
        contributorSeatIndexes: [0, 1, 2, 3],
        eligibleSeatIndexes: [0, 1, 2, 3],
        rakeApplied: 0,
        winnerSeatIndexes: [1, 2],
        oddChipSeatIndexes: [],
        awards: [
          { seatIndex: 1, participantId: "ben", amount: 100 },
          { seatIndex: 2, participantId: "cy", amount: 100 }
        ]
      },
      {
        potIndex: 1,
        potType: "SIDE",
        capLevel: 120,
        amount: 210,
        contributorSeatIndexes: [1, 2, 3],
        eligibleSeatIndexes: [1, 2, 3],
        rakeApplied: 0,
        winnerSeatIndexes: [1, 2],
        oddChipSeatIndexes: [],
        awards: [
          { seatIndex: 1, participantId: "ben", amount: 105 },
          { seatIndex: 2, participantId: "cy", amount: 105 }
        ]
      },
      {
        potIndex: 2,
        potType: "SIDE",
        capLevel: 200,
        amount: 160,
        contributorSeatIndexes: [2, 3],
        eligibleSeatIndexes: [2, 3],
        rakeApplied: 0,
        winnerSeatIndexes: [2],
        oddChipSeatIndexes: [],
        awards: [{ seatIndex: 2, participantId: "cy", amount: 160 }]
      }
    ]);
    expect(settlement.playerResults).toEqual([
      {
        seatIndex: 0,
        participantId: "ava",
        contributed: 50,
        won: 0,
        finalStack: 0,
        netResult: -50
      },
      {
        seatIndex: 1,
        participantId: "ben",
        contributed: 120,
        won: 205,
        finalStack: 205,
        netResult: 85
      },
      {
        seatIndex: 2,
        participantId: "cy",
        contributed: 200,
        won: 365,
        finalStack: 465,
        netResult: 165
      },
      {
        seatIndex: 3,
        participantId: "dia",
        contributed: 200,
        won: 0,
        finalStack: 100,
        netResult: -200
      }
    ]);
  });

  it("keeps folded contributions in the pots and applies odd chips left of the button", () => {
    const settlement = settleHoldemHand(
      createSettlementInput({
        handId: "hand_odd_chip",
        handNumber: 13,
        buttonSeatIndex: 1,
        potTotal: 585,
        seatOrder: [2, 3, 5, 6, 8],
        board: ["9C", "TC", "JD", "2S", "2D"],
        players: [
          createPlayer({
            seatIndex: 2,
            participantId: "nia",
            startingStack: 25,
            stack: 0,
            status: "ALL_IN",
            holeCards: ["AH", "7S"],
            totalCommitted: 25
          }),
          createPlayer({
            seatIndex: 3,
            participantId: "omar",
            startingStack: 80,
            stack: 0,
            status: "ALL_IN",
            holeCards: ["QH", "KC"],
            totalCommitted: 80
          }),
          createPlayer({
            seatIndex: 5,
            participantId: "pia",
            startingStack: 80,
            stack: 0,
            status: "ALL_IN",
            holeCards: ["QS", "KD"],
            totalCommitted: 80
          }),
          createPlayer({
            seatIndex: 6,
            participantId: "quin",
            startingStack: 300,
            stack: 100,
            status: "ACTIVE",
            holeCards: ["9H", "8H"],
            totalCommitted: 200
          }),
          createPlayer({
            seatIndex: 8,
            participantId: "rui",
            startingStack: 300,
            stack: 100,
            status: "FOLDED",
            holeCards: ["AC", "4C"],
            totalCommitted: 200
          })
        ]
      })
    );

    expect(settlement.pots[0]).toEqual({
      potIndex: 0,
      potType: "MAIN",
      capLevel: 25,
      amount: 125,
      contributorSeatIndexes: [2, 3, 5, 6, 8],
      eligibleSeatIndexes: [2, 3, 5, 6],
      rakeApplied: 0,
      winnerSeatIndexes: [3, 5],
      oddChipSeatIndexes: [3],
      awards: [
        { seatIndex: 3, participantId: "omar", amount: 63 },
        { seatIndex: 5, participantId: "pia", amount: 62 }
      ]
    });
    expect(settlement.pots[1]).toEqual({
      potIndex: 1,
      potType: "SIDE",
      capLevel: 80,
      amount: 220,
      contributorSeatIndexes: [3, 5, 6, 8],
      eligibleSeatIndexes: [3, 5, 6],
      rakeApplied: 0,
      winnerSeatIndexes: [3, 5],
      oddChipSeatIndexes: [],
      awards: [
        { seatIndex: 3, participantId: "omar", amount: 110 },
        { seatIndex: 5, participantId: "pia", amount: 110 }
      ]
    });
    expect(settlement.pots[2]).toEqual({
      potIndex: 2,
      potType: "SIDE",
      capLevel: 200,
      amount: 240,
      contributorSeatIndexes: [6, 8],
      eligibleSeatIndexes: [6],
      rakeApplied: 0,
      winnerSeatIndexes: [6],
      oddChipSeatIndexes: [],
      awards: [{ seatIndex: 6, participantId: "quin", amount: 240 }]
    });
    expect(settlement.playerResults).toEqual([
      {
        seatIndex: 2,
        participantId: "nia",
        contributed: 25,
        won: 0,
        finalStack: 0,
        netResult: -25
      },
      {
        seatIndex: 3,
        participantId: "omar",
        contributed: 80,
        won: 173,
        finalStack: 173,
        netResult: 93
      },
      {
        seatIndex: 5,
        participantId: "pia",
        contributed: 80,
        won: 172,
        finalStack: 172,
        netResult: 92
      },
      {
        seatIndex: 6,
        participantId: "quin",
        contributed: 200,
        won: 240,
        finalStack: 340,
        netResult: 40
      },
      {
        seatIndex: 8,
        participantId: "rui",
        contributed: 200,
        won: 0,
        finalStack: 100,
        netResult: -200
      }
    ]);
  });

  it("applies rake once per hand subject to the configured cap", () => {
    const settlement = settleHoldemHand(
      createSettlementInput({
        handId: "hand_rake_cap",
        handNumber: 14,
        buttonSeatIndex: 0,
        potTotal: 1000,
        seatOrder: [0, 1],
        board: ["AH", "KH", "QH", "JH", "2C"],
        players: [
          createPlayer({
            seatIndex: 0,
            participantId: "alpha",
            startingStack: 500,
            stack: 0,
            status: "ALL_IN",
            holeCards: ["TH", "9D"],
            totalCommitted: 500
          }),
          createPlayer({
            seatIndex: 1,
            participantId: "bravo",
            startingStack: 500,
            stack: 0,
            status: "ALL_IN",
            holeCards: ["2D", "3D"],
            totalCommitted: 500
          })
        ]
      }),
      {
        rakeConfig: {
          enabled: true,
          percent: 5,
          cap: 30
        }
      }
    );

    expect(settlement.totalRake).toBe(30);
    expect(settlement.pots[0]).toMatchObject({
      amount: 1000,
      rakeApplied: 30,
      winnerSeatIndexes: [0],
      awards: [{ seatIndex: 0, participantId: "alpha", amount: 970 }]
    });
    expect(settlement.playerResults[0]).toMatchObject({
      seatIndex: 0,
      won: 970,
      finalStack: 970,
      netResult: 470
    });
  });

  it("settles direct fold wins without requiring showdown cards", () => {
    const settlement = settleHoldemHand(
      createSettlementInput({
        handId: "hand_awarded_fold",
        handNumber: 15,
        buttonSeatIndex: 0,
        potTotal: 150,
        seatOrder: [0, 1],
        board: [],
        winnerByFoldSeatIndex: 1,
        players: [
          createPlayer({
            seatIndex: 0,
            participantId: "alpha",
            startingStack: 1000,
            stack: 950,
            status: "FOLDED",
            holeCards: ["AS", "KD"],
            totalCommitted: 50
          }),
          createPlayer({
            seatIndex: 1,
            participantId: "bravo",
            startingStack: 1000,
            stack: 900,
            status: "ACTIVE",
            holeCards: ["QC", "QS"],
            totalCommitted: 100
          })
        ]
      })
    );

    expect(settlement.awardedByFold).toBe(true);
    expect(settlement.showdownResults).toEqual([]);
    expect(settlement.pots).toEqual([
      {
        potIndex: 0,
        potType: "MAIN",
        capLevel: 50,
        amount: 100,
        contributorSeatIndexes: [0, 1],
        eligibleSeatIndexes: [1],
        rakeApplied: 0,
        winnerSeatIndexes: [1],
        oddChipSeatIndexes: [],
        awards: [{ seatIndex: 1, participantId: "bravo", amount: 100 }]
      },
      {
        potIndex: 1,
        potType: "SIDE",
        capLevel: 100,
        amount: 50,
        contributorSeatIndexes: [1],
        eligibleSeatIndexes: [1],
        rakeApplied: 0,
        winnerSeatIndexes: [1],
        oddChipSeatIndexes: [],
        awards: [{ seatIndex: 1, participantId: "bravo", amount: 50 }]
      }
    ]);
    expect(settlement.playerResults).toEqual([
      {
        seatIndex: 0,
        participantId: "alpha",
        contributed: 50,
        won: 0,
        finalStack: 950,
        netResult: -50
      },
      {
        seatIndex: 1,
        participantId: "bravo",
        contributed: 100,
        won: 150,
        finalStack: 1050,
        netResult: 50
      }
    ]);
  });
});

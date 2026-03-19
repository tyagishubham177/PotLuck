export const HOLD_EM_ENGINE_NAME = "holdem-engine-v1";

export type EngineMetadata = {
  name: typeof HOLD_EM_ENGINE_NAME;
  supportedVariants: ["holdem"];
};

export type CardCode = string;
export type BettingStreet = "PREFLOP" | "FLOP" | "TURN" | "RIVER";
export type HoldemStreet = BettingStreet | "SHOWDOWN";
export type HoldemPlayerStatus = "ACTIVE" | "FOLDED" | "ALL_IN";
export type HoldemActionType =
  | "CHECK"
  | "FOLD"
  | "CALL"
  | "BET"
  | "RAISE"
  | "ALL_IN"
  | "TIMEOUT_FOLD";
export type HoldemEngineErrorCode =
  | "ERR_ACTION_INVALID"
  | "ERR_NOT_YOUR_TURN"
  | "ERR_INSUFFICIENT_STACK"
  | "ERR_MIN_RAISE";

export type HoldemActionRecord = {
  seq: number;
  seatIndex: number;
  participantId: string;
  street: BettingStreet;
  actionType: HoldemActionType;
  normalizedAmount?: number;
  contributedAmount: number;
  totalCommitted: number;
  streetCommitted: number;
};

export type HoldemForcedCommitment = {
  seatIndex: number;
  participantId: string;
  type: "ANTE" | "SMALL_BLIND" | "BIG_BLIND";
  amount: number;
};

export type HoldemPlayerState = {
  seatIndex: number;
  participantId: string;
  startingStack: number;
  stack: number;
  status: HoldemPlayerStatus;
  holeCards: [CardCode, CardCode];
  totalCommitted: number;
  streetCommitted: number;
  contributedByStreet: Record<BettingStreet, number>;
  hasActedThisRound: boolean;
  canRaiseThisRound: boolean;
};

export type HoldemHandState = {
  handId: string;
  handNumber: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  street: HoldemStreet;
  handStatus: "BETTING" | "SHOWDOWN_PENDING" | "AWARDED";
  buttonSeatIndex?: number;
  smallBlindSeatIndex?: number;
  bigBlindSeatIndex?: number;
  actingSeatIndex?: number;
  currentBet: number;
  minimumRaiseTo: number;
  potTotal: number;
  board: CardCode[];
  deck: CardCode[];
  seatOrder: number[];
  players: HoldemPlayerState[];
  actionLog: HoldemActionRecord[];
  forcedCommitments: HoldemForcedCommitment[];
  lastAggressorSeatIndex?: number;
  showdownSeatIndexes: number[];
  showdownRevealOrder: number[];
  winnerByFoldSeatIndex?: number;
};

export type HoldemActionAffordances = {
  canFold: boolean;
  canCheck: boolean;
  callAmount?: number;
  minRaiseTo?: number;
  maxRaiseTo?: number;
  allInAmount?: number;
  presetAmounts: number[];
};

export type HoldemActionIntent = {
  seatIndex: number;
  actionType: Exclude<HoldemActionType, "TIMEOUT_FOLD">;
  amount?: number;
};

export type HoldemTransitionEffect =
  | {
      type: "STREET_ADVANCED";
      street: BettingStreet;
      board: CardCode[];
      revealedCards: CardCode[];
    }
  | {
      type: "SHOWDOWN_TRIGGERED";
      board: CardCode[];
      eligibleSeatIndexes: number[];
      revealOrder: number[];
    }
  | {
      type: "HAND_AWARDED";
      winningSeatIndex: number;
      potTotal: number;
    };

export type HoldemTransition = {
  state: HoldemHandState;
  normalizedAction: HoldemActionRecord;
  effects: HoldemTransitionEffect[];
};

export type StartHoldemHandOptions = {
  handId: string;
  handNumber: number;
  previousButtonSeatIndex?: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  players: Array<{
    seatIndex: number;
    participantId: string;
    stack: number;
  }>;
  deck?: CardCode[];
  seed?: string;
};

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
const SUITS = ["C", "D", "H", "S"] as const;

export class HoldemEngineError extends Error {
  readonly code: HoldemEngineErrorCode;

  constructor(code: HoldemEngineErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "HoldemEngineError";
  }
}

function assert(condition: unknown, code: HoldemEngineErrorCode, message: string): asserts condition {
  if (!condition) {
    throw new HoldemEngineError(code, message);
  }
}

function createPlayerState(player: StartHoldemHandOptions["players"][number]): HoldemPlayerState {
  return {
    seatIndex: player.seatIndex,
    participantId: player.participantId,
    startingStack: player.stack,
    stack: player.stack,
    status: "ACTIVE",
    holeCards: ["", ""],
    totalCommitted: 0,
    streetCommitted: 0,
    contributedByStreet: {
      PREFLOP: 0,
      FLOP: 0,
      TURN: 0,
      RIVER: 0
    },
    hasActedThisRound: false,
    canRaiseThisRound: true
  };
}

function getPlayer(state: HoldemHandState, seatIndex: number) {
  return state.players.find((player) => player.seatIndex === seatIndex);
}

function getNextSeat(fromSeatIndex: number | undefined, seatOrder: number[]) {
  assert(seatOrder.length > 0, "ERR_ACTION_INVALID", "At least one seat is required.");

  if (fromSeatIndex === undefined) {
    return seatOrder[0];
  }

  const currentIndex = seatOrder.indexOf(fromSeatIndex);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % seatOrder.length : 0;
  return seatOrder[nextIndex] ?? seatOrder[0];
}

function getClockwiseSeatOrderFrom(startSeatIndex: number, seatOrder: number[]) {
  const startIndex = seatOrder.indexOf(startSeatIndex);

  if (startIndex < 0) {
    return [...seatOrder];
  }

  return [...seatOrder.slice(startIndex), ...seatOrder.slice(0, startIndex)];
}

function isLive(player: HoldemPlayerState) {
  return player.status !== "FOLDED";
}

function isActionable(player: HoldemPlayerState) {
  return player.status === "ACTIVE" && player.stack > 0;
}

function getLivePlayers(state: HoldemHandState) {
  return state.players.filter(isLive);
}

function getActionablePlayers(state: HoldemHandState) {
  return state.players.filter(isActionable);
}

function getNextActionableSeat(state: HoldemHandState, fromSeatIndex: number | undefined) {
  if (fromSeatIndex === undefined) {
    return undefined;
  }

  let cursor = fromSeatIndex;

  for (let steps = 0; steps < state.seatOrder.length; steps += 1) {
    cursor = getNextSeat(cursor, state.seatOrder);
    const player = getPlayer(state, cursor);

    if (player && isActionable(player)) {
      return cursor;
    }
  }

  return undefined;
}

function getFirstLiveLeftOfButton(state: HoldemHandState) {
  if (state.buttonSeatIndex === undefined) {
    return getLivePlayers(state)[0]?.seatIndex;
  }

  let cursor = state.buttonSeatIndex;

  for (let steps = 0; steps < state.seatOrder.length; steps += 1) {
    cursor = getNextSeat(cursor, state.seatOrder);
    const player = getPlayer(state, cursor);

    if (player && isLive(player)) {
      return cursor;
    }
  }

  return undefined;
}

function getFirstPostflopActor(state: HoldemHandState) {
  if (state.buttonSeatIndex === undefined) {
    return undefined;
  }

  let cursor = state.buttonSeatIndex;

  for (let steps = 0; steps < state.seatOrder.length; steps += 1) {
    cursor = getNextSeat(cursor, state.seatOrder);
    const player = getPlayer(state, cursor);

    if (player && isActionable(player)) {
      return cursor;
    }
  }

  return undefined;
}

function commitChips(
  state: HoldemHandState,
  player: HoldemPlayerState,
  amount: number,
  street: BettingStreet
) {
  const committed = Math.max(0, Math.min(amount, player.stack));

  player.stack -= committed;
  player.totalCommitted += committed;
  player.streetCommitted += committed;
  player.contributedByStreet[street] += committed;
  state.potTotal += committed;

  if (player.stack === 0 && player.status === "ACTIVE") {
    player.status = "ALL_IN";
  }

  return committed;
}

function postForcedCommitment(
  state: HoldemHandState,
  player: HoldemPlayerState,
  amount: number,
  type: HoldemForcedCommitment["type"]
) {
  const committed = commitChips(state, player, amount, "PREFLOP");

  state.forcedCommitments.push({
    seatIndex: player.seatIndex,
    participantId: player.participantId,
    type,
    amount: committed
  });

  return committed;
}

function createSeededRandom(seed: string) {
  let hash = 2166136261;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function dealCard(state: HoldemHandState) {
  const card = state.deck.shift();
  assert(card, "ERR_ACTION_INVALID", "The deck ran out of cards.");
  return card;
}

function revealCards(state: HoldemHandState, count: number) {
  return Array.from({ length: count }, () => dealCard(state));
}

function resetRoundState(state: HoldemHandState, street: BettingStreet, preserveAggressor: boolean) {
  state.street = street;
  state.currentBet = 0;
  state.minimumRaiseTo = state.bigBlind;
  state.actingSeatIndex = undefined;

  for (const player of state.players) {
    player.streetCommitted = 0;
    player.hasActedThisRound = false;
    player.canRaiseThisRound = isActionable(player);
  }

  if (!preserveAggressor) {
    state.lastAggressorSeatIndex = undefined;
  }
}

function triggerShowdown(state: HoldemHandState, effects: HoldemTransitionEffect[]) {
  const liveSeatIndexes = getLivePlayers(state).map((player) => player.seatIndex);
  const revealStartSeatIndex =
    state.lastAggressorSeatIndex !== undefined && liveSeatIndexes.includes(state.lastAggressorSeatIndex)
      ? state.lastAggressorSeatIndex
      : getFirstLiveLeftOfButton(state) ?? liveSeatIndexes[0];

  state.handStatus = "SHOWDOWN_PENDING";
  state.street = "SHOWDOWN";
  state.actingSeatIndex = undefined;
  state.showdownSeatIndexes = getClockwiseSeatOrderFrom(revealStartSeatIndex ?? liveSeatIndexes[0] ?? 0, state.seatOrder).filter(
    (seatIndex) => liveSeatIndexes.includes(seatIndex)
  );
  state.showdownRevealOrder = [...state.showdownSeatIndexes];

  effects.push({
    type: "SHOWDOWN_TRIGGERED",
    board: [...state.board],
    eligibleSeatIndexes: [...state.showdownSeatIndexes],
    revealOrder: [...state.showdownRevealOrder]
  });
}

function advanceToNextStreet(
  state: HoldemHandState,
  effects: HoldemTransitionEffect[],
  preserveAggressor: boolean
) {
  if (state.street === "PREFLOP") {
    const revealedCards = revealCards(state, 3);
    state.board.push(...revealedCards);
    resetRoundState(state, "FLOP", preserveAggressor);
    effects.push({
      type: "STREET_ADVANCED",
      street: "FLOP",
      board: [...state.board],
      revealedCards
    });
    state.actingSeatIndex = getFirstPostflopActor(state);
    return;
  }

  if (state.street === "FLOP") {
    const revealedCards = revealCards(state, 1);
    state.board.push(...revealedCards);
    resetRoundState(state, "TURN", preserveAggressor);
    effects.push({
      type: "STREET_ADVANCED",
      street: "TURN",
      board: [...state.board],
      revealedCards
    });
    state.actingSeatIndex = getFirstPostflopActor(state);
    return;
  }

  if (state.street === "TURN") {
    const revealedCards = revealCards(state, 1);
    state.board.push(...revealedCards);
    resetRoundState(state, "RIVER", preserveAggressor);
    effects.push({
      type: "STREET_ADVANCED",
      street: "RIVER",
      board: [...state.board],
      revealedCards
    });
    state.actingSeatIndex = getFirstPostflopActor(state);
    return;
  }

  triggerShowdown(state, effects);
}

function finishRoundOrHand(
  state: HoldemHandState,
  lastActorSeatIndex: number,
  effects: HoldemTransitionEffect[]
) {
  const livePlayers = getLivePlayers(state);

  if (livePlayers.length === 1) {
    const winner = livePlayers[0];

    state.handStatus = "AWARDED";
    state.actingSeatIndex = undefined;
    state.winnerByFoldSeatIndex = winner?.seatIndex;
    state.showdownSeatIndexes = [];
    state.showdownRevealOrder = [];

    effects.push({
      type: "HAND_AWARDED",
      winningSeatIndex: winner?.seatIndex ?? 0,
      potTotal: state.potTotal
    });
    return;
  }

  const actionablePlayers = getActionablePlayers(state);
  const bettingClosed =
    actionablePlayers.length === 0 ||
    actionablePlayers.every(
      (player) => player.hasActedThisRound && player.streetCommitted === state.currentBet
    );

  if (!bettingClosed) {
    state.actingSeatIndex = getNextActionableSeat(state, lastActorSeatIndex);
    return;
  }

  if (state.street === "RIVER") {
    triggerShowdown(state, effects);
    return;
  }

  const preserveAggressor = actionablePlayers.length === 0;
  advanceToNextStreet(state, effects, preserveAggressor);

  if (state.handStatus !== "BETTING") {
    return;
  }

  while (state.handStatus === "BETTING" && getActionablePlayers(state).length === 0) {
    advanceToNextStreet(state, effects, true);
  }
}

function withRaisePresets(minRaiseTo: number | undefined, maxRaiseTo: number | undefined) {
  if (minRaiseTo === undefined || maxRaiseTo === undefined) {
    return [];
  }

  if (minRaiseTo >= maxRaiseTo) {
    return [maxRaiseTo];
  }

  return [...new Set([minRaiseTo, maxRaiseTo])];
}

export function createEngineMetadata(): EngineMetadata {
  return {
    name: HOLD_EM_ENGINE_NAME,
    supportedVariants: ["holdem"]
  };
}

export const createEnginePlaceholder = createEngineMetadata;

export function createShuffledDeck(seed = "potluck-default-seed") {
  const deck = RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}`));
  const random = createSeededRandom(seed);

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = deck[index];
    deck[index] = deck[swapIndex] ?? current;
    deck[swapIndex] = current;
  }

  return deck;
}

export function getHandSequence(state: HoldemHandState) {
  return state.actionLog.length;
}

export function getPlayerHoleCards(state: HoldemHandState, seatIndex: number) {
  return getPlayer(state, seatIndex)?.holeCards;
}

export function getLegalActions(
  state: HoldemHandState,
  seatIndex: number
): HoldemActionAffordances | undefined {
  if (state.handStatus !== "BETTING" || state.street === "SHOWDOWN" || state.actingSeatIndex !== seatIndex) {
    return undefined;
  }

  const player = getPlayer(state, seatIndex);

  if (!player || !isActionable(player)) {
    return undefined;
  }

  const toCall = Math.max(0, state.currentBet - player.streetCommitted);
  const allInAmount = player.streetCommitted + player.stack;
  const maxRaiseTo =
    player.canRaiseThisRound && player.stack > toCall ? allInAmount : undefined;
  const minRaiseTo =
    player.canRaiseThisRound &&
    maxRaiseTo !== undefined &&
    maxRaiseTo >= state.minimumRaiseTo
      ? state.minimumRaiseTo
      : undefined;

  return {
    canFold: true,
    canCheck: toCall === 0,
    callAmount: toCall > 0 ? Math.min(toCall, player.stack) : undefined,
    minRaiseTo,
    maxRaiseTo,
    allInAmount: player.stack > 0 ? allInAmount : undefined,
    presetAmounts: withRaisePresets(minRaiseTo, maxRaiseTo)
  };
}

export function startHoldemHand(options: StartHoldemHandOptions): HoldemHandState {
  assert(
    options.players.length >= 2,
    "ERR_ACTION_INVALID",
    "At least two players are required to start a hand."
  );

  const seatOrder = [...options.players]
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .map((player) => player.seatIndex);
  const state: HoldemHandState = {
    handId: options.handId,
    handNumber: options.handNumber,
    smallBlind: options.smallBlind,
    bigBlind: options.bigBlind,
    ante: options.ante,
    street: "PREFLOP",
    handStatus: "BETTING",
    currentBet: 0,
    minimumRaiseTo: options.bigBlind,
    potTotal: 0,
    board: [],
    deck: [...(options.deck ?? createShuffledDeck(options.seed ?? options.handId))],
    seatOrder,
    players: options.players.map(createPlayerState),
    actionLog: [],
    forcedCommitments: [],
    showdownSeatIndexes: [],
    showdownRevealOrder: []
  };

  const isHeadsUp = state.players.length === 2;
  const previousButtonSeatIndex =
    options.previousButtonSeatIndex ?? seatOrder[seatOrder.length - 1];
  const buttonSeatIndex = getNextSeat(previousButtonSeatIndex, seatOrder);
  const smallBlindSeatIndex = isHeadsUp ? buttonSeatIndex : getNextSeat(buttonSeatIndex, seatOrder);
  const bigBlindSeatIndex = getNextSeat(smallBlindSeatIndex, seatOrder);

  state.buttonSeatIndex = buttonSeatIndex;
  state.smallBlindSeatIndex = smallBlindSeatIndex;
  state.bigBlindSeatIndex = bigBlindSeatIndex;

  for (const player of state.players) {
    if (options.ante > 0) {
      postForcedCommitment(state, player, options.ante, "ANTE");
    }
  }

  const smallBlindPlayer = getPlayer(state, smallBlindSeatIndex);
  const bigBlindPlayer = getPlayer(state, bigBlindSeatIndex);

  assert(smallBlindPlayer, "ERR_ACTION_INVALID", "Small blind seat is not available.");
  assert(bigBlindPlayer, "ERR_ACTION_INVALID", "Big blind seat is not available.");

  const postedSmallBlind = postForcedCommitment(
    state,
    smallBlindPlayer,
    options.smallBlind,
    "SMALL_BLIND"
  );
  const postedBigBlind = postForcedCommitment(
    state,
    bigBlindPlayer,
    options.bigBlind,
    "BIG_BLIND"
  );

  for (const seatIndex of seatOrder) {
    const player = getPlayer(state, seatIndex);
    assert(player, "ERR_ACTION_INVALID", "A participating seat disappeared during dealing.");
    player.holeCards[0] = dealCard(state);
  }

  for (const seatIndex of seatOrder) {
    const player = getPlayer(state, seatIndex);
    assert(player, "ERR_ACTION_INVALID", "A participating seat disappeared during dealing.");
    player.holeCards[1] = dealCard(state);
  }

  state.currentBet = Math.max(postedSmallBlind, postedBigBlind);
  state.minimumRaiseTo =
    state.currentBet < options.bigBlind ? options.bigBlind : state.currentBet + options.bigBlind;

  const preflopFirstActor = isHeadsUp
    ? buttonSeatIndex
    : getNextSeat(bigBlindSeatIndex, seatOrder);
  const preflopPlayer = getPlayer(state, preflopFirstActor);
  state.actingSeatIndex =
    preflopPlayer && isActionable(preflopPlayer)
      ? preflopFirstActor
      : getNextActionableSeat(state, preflopFirstActor);

  return state;
}

export function applyHoldemAction(
  state: HoldemHandState,
  intent: HoldemActionIntent | { seatIndex: number; actionType: "TIMEOUT_FOLD" }
): HoldemTransition {
  assert(
    state.handStatus === "BETTING" && state.street !== "SHOWDOWN",
    "ERR_ACTION_INVALID",
    "This hand cannot accept more actions."
  );

  const next = structuredClone(state);
  const player = getPlayer(next, intent.seatIndex);

  assert(player, "ERR_ACTION_INVALID", "That seat is not part of the active hand.");
  assert(
    next.actingSeatIndex === intent.seatIndex,
    "ERR_NOT_YOUR_TURN",
    "It is not that seat's turn to act."
  );
  assert(isActionable(player), "ERR_ACTION_INVALID", "That seat can no longer act in this hand.");

  const legalActions = getLegalActions(next, intent.seatIndex);
  assert(legalActions, "ERR_ACTION_INVALID", "No legal action set is available for that seat.");

  const street = next.street;
  assert(street !== "SHOWDOWN", "ERR_ACTION_INVALID", "Showdown does not accept player actions.");

  const toCall = Math.max(0, next.currentBet - player.streetCommitted);
  const allInTarget = player.streetCommitted + player.stack;
  const effects: HoldemTransitionEffect[] = [];
  let actionType: HoldemActionType = intent.actionType;
  let contributedAmount = 0;
  let normalizedAmount: number | undefined;

  const reopenAction = () => {
    for (const otherPlayer of next.players) {
      const isActor = otherPlayer.seatIndex === player.seatIndex;
      otherPlayer.hasActedThisRound = isActor;
      otherPlayer.canRaiseThisRound = isActor ? false : isActionable(otherPlayer);
    }
  };

  const applyTargetCommitment = (target: number, requestedType: HoldemActionType) => {
    assert(
      target <= allInTarget,
      "ERR_INSUFFICIENT_STACK",
      "The target amount is larger than the available stack."
    );

    const delta = target - player.streetCommitted;
    assert(delta > 0, "ERR_ACTION_INVALID", "That action does not add any chips.");

    contributedAmount = commitChips(next, player, delta, street);
    normalizedAmount = target;

    if (target <= next.currentBet) {
      player.hasActedThisRound = true;
      player.canRaiseThisRound = false;
      return;
    }

    const previousBet = next.currentBet;
    const isFullRaise = target >= next.minimumRaiseTo;

    next.currentBet = target;
    next.lastAggressorSeatIndex = player.seatIndex;

    if (isFullRaise) {
      const raiseSize = previousBet === 0 ? target : target - previousBet;
      next.minimumRaiseTo = target + raiseSize;
      reopenAction();
    } else {
      player.hasActedThisRound = true;
      player.canRaiseThisRound = false;
    }

    actionType = requestedType;
  };

  switch (intent.actionType) {
    case "CHECK": {
      assert(legalActions.canCheck, "ERR_ACTION_INVALID", "Check is not legal right now.");
      player.hasActedThisRound = true;
      player.canRaiseThisRound = false;
      break;
    }
    case "FOLD":
    case "TIMEOUT_FOLD": {
      player.status = "FOLDED";
      player.hasActedThisRound = true;
      player.canRaiseThisRound = false;
      break;
    }
    case "CALL": {
      assert(toCall > 0, "ERR_ACTION_INVALID", "There is nothing to call right now.");
      const target = player.streetCommitted + Math.min(toCall, player.stack);
      applyTargetCommitment(target, target < next.currentBet ? "ALL_IN" : "CALL");

      if (target < next.currentBet) {
        actionType = "ALL_IN";
      }
      break;
    }
    case "BET":
    case "RAISE": {
      const requestedTarget = intent.amount;

      assert(
        Number.isInteger(requestedTarget),
        "ERR_ACTION_INVALID",
        "A target amount is required for bet and raise actions."
      );
      assert(
        requestedTarget! > next.currentBet,
        "ERR_ACTION_INVALID",
        "Bet and raise actions must increase the current wager."
      );

      const isAllIn = requestedTarget === allInTarget;

      if (requestedTarget! < next.minimumRaiseTo && !isAllIn) {
        throw new HoldemEngineError(
          "ERR_MIN_RAISE",
          `The minimum legal raise target is ${next.minimumRaiseTo.toLocaleString()}.`
        );
      }

      applyTargetCommitment(requestedTarget!, next.currentBet === 0 ? "BET" : "RAISE");
      break;
    }
    case "ALL_IN": {
      assert(
        allInTarget > player.streetCommitted,
        "ERR_ACTION_INVALID",
        "There are no chips left to move all-in."
      );
      applyTargetCommitment(allInTarget, "ALL_IN");
      break;
    }
  }

  const normalizedAction: HoldemActionRecord = {
    seq: next.actionLog.length + 1,
    seatIndex: player.seatIndex,
    participantId: player.participantId,
    street,
    actionType,
    normalizedAmount,
    contributedAmount,
    totalCommitted: player.totalCommitted,
    streetCommitted: player.streetCommitted
  };

  next.actionLog.push(normalizedAction);
  finishRoundOrHand(next, player.seatIndex, effects);

  return {
    state: next,
    normalizedAction,
    effects
  };
}

export type HoldemSettlementPlayerState = Pick<
  HoldemPlayerState,
  | "seatIndex"
  | "participantId"
  | "startingStack"
  | "stack"
  | "status"
  | "holeCards"
  | "totalCommitted"
  | "contributedByStreet"
>;

export type HoldemSettlementInput = {
  handId: string;
  handNumber: number;
  buttonSeatIndex?: number;
  smallBlindSeatIndex?: number;
  bigBlindSeatIndex?: number;
  potTotal: number;
  board: CardCode[];
  seatOrder: number[];
  players: HoldemSettlementPlayerState[];
  actionLog: HoldemActionRecord[];
  forcedCommitments: HoldemForcedCommitment[];
  winnerByFoldSeatIndex?: number;
};

export type HoldemOddChipRule = "LEFT_OF_BUTTON";
export type HoldemRakeMode = "PER_HAND";

export type HoldemRakeConfig = {
  enabled: boolean;
  percent: number;
  cap: number;
  mode?: HoldemRakeMode;
};

export type HoldemHandRankCategory =
  | "HIGH_CARD"
  | "ONE_PAIR"
  | "TWO_PAIR"
  | "THREE_OF_A_KIND"
  | "STRAIGHT"
  | "FLUSH"
  | "FULL_HOUSE"
  | "FOUR_OF_A_KIND"
  | "STRAIGHT_FLUSH";

export type HoldemHandRank = {
  category: HoldemHandRankCategory;
  label: string;
  comparisonValues: number[];
  bestFiveCards: [CardCode, CardCode, CardCode, CardCode, CardCode];
};

export type HoldemShowdownResult = {
  seatIndex: number;
  participantId: string;
  holeCards: [CardCode, CardCode];
  rank: HoldemHandRank;
};

export type HoldemPotAward = {
  seatIndex: number;
  participantId: string;
  amount: number;
};

export type HoldemSettlementPot = {
  potIndex: number;
  potType: "MAIN" | "SIDE";
  capLevel: number;
  amount: number;
  contributorSeatIndexes: number[];
  eligibleSeatIndexes: number[];
  rakeApplied: number;
  winnerSeatIndexes: number[];
  oddChipSeatIndexes: number[];
  awards: HoldemPotAward[];
};

export type HoldemSettlementPlayerResult = {
  seatIndex: number;
  participantId: string;
  contributed: number;
  won: number;
  finalStack: number;
  netResult: number;
};

export type HoldemHandSettlement = {
  handId: string;
  handNumber: number;
  oddChipRule: HoldemOddChipRule;
  rakeConfig: Required<HoldemRakeConfig>;
  totalPot: number;
  totalRake: number;
  awardedByFold: boolean;
  showdownResults: HoldemShowdownResult[];
  pots: HoldemSettlementPot[];
  playerResults: HoldemSettlementPlayerResult[];
};

type EvaluatedHand = HoldemHandRank & {
  categoryValue: number;
};

const RANK_NAME_BY_VALUE: Record<number, string> = {
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine",
  10: "Ten",
  11: "Jack",
  12: "Queen",
  13: "King",
  14: "Ace"
};
const RANK_PLURAL_BY_VALUE: Record<number, string> = {
  2: "Twos",
  3: "Threes",
  4: "Fours",
  5: "Fives",
  6: "Sixes",
  7: "Sevens",
  8: "Eights",
  9: "Nines",
  10: "Tens",
  11: "Jacks",
  12: "Queens",
  13: "Kings",
  14: "Aces"
};
const CATEGORY_VALUE_BY_NAME: Record<HoldemHandRankCategory, number> = {
  HIGH_CARD: 0,
  ONE_PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8
};

function getCardRankValue(card: CardCode) {
  return RANKS.indexOf((card[0] ?? "2") as (typeof RANKS)[number]) + 2;
}

function getCardSuitValue(card: CardCode) {
  return card[1] ?? "";
}

function compareNumberLists(left: number[], right: number[]) {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);

    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

function compareEvaluatedHands(left: EvaluatedHand, right: EvaluatedHand) {
  if (left.categoryValue !== right.categoryValue) {
    return left.categoryValue - right.categoryValue;
  }

  return compareNumberLists(left.comparisonValues, right.comparisonValues);
}

function comparePublicRanks(left: HoldemHandRank, right: HoldemHandRank) {
  const categoryDelta =
    CATEGORY_VALUE_BY_NAME[left.category] - CATEGORY_VALUE_BY_NAME[right.category];

  if (categoryDelta !== 0) {
    return categoryDelta;
  }

  return compareNumberLists(left.comparisonValues, right.comparisonValues);
}

function normalizeRakeConfig(rakeConfig: HoldemRakeConfig): Required<HoldemRakeConfig> {
  return {
    enabled: rakeConfig.enabled,
    percent: Math.max(0, rakeConfig.percent),
    cap: Math.max(0, Math.trunc(rakeConfig.cap)),
    mode: rakeConfig.mode ?? "PER_HAND"
  };
}

function sortSeatIndexesBySeatOrder(seatIndexes: number[], seatOrder: number[]) {
  return [...seatIndexes].sort((left, right) => {
    const leftIndex = seatOrder.indexOf(left);
    const rightIndex = seatOrder.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left - right;
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

function getStraightHighCard(rankValues: number[]) {
  const uniqueDescending = [...new Set(rankValues)].sort((left, right) => right - left);

  if (uniqueDescending.includes(14)) {
    uniqueDescending.push(1);
  }

  for (let index = 0; index <= uniqueDescending.length - 5; index += 1) {
    const window = uniqueDescending.slice(index, index + 5);
    const isStraight = window.every(
      (value, windowIndex) => windowIndex === 0 || window[windowIndex - 1] === value + 1
    );

    if (isStraight) {
      return window[0] === 1 ? 5 : window[0];
    }
  }

  return undefined;
}

function orderCardsForStraight(cards: CardCode[], highCard: number) {
  const desiredRanks =
    highCard === 5
      ? [5, 4, 3, 2, 14]
      : [highCard, highCard - 1, highCard - 2, highCard - 3, highCard - 4];

  return desiredRanks.map((value) => {
    const matched = cards.find((card) => getCardRankValue(card) === value);

    if (!matched) {
      throw new Error("Straight card ordering failed.");
    }

    return matched;
  }) as [CardCode, CardCode, CardCode, CardCode, CardCode];
}

function orderCardsByRanks(cards: CardCode[], ranks: number[]) {
  const remaining = [...cards];

  return ranks.map((rank) => {
    const cardIndex = remaining.findIndex((card) => getCardRankValue(card) === rank);

    if (cardIndex === -1) {
      throw new Error("Card ordering failed.");
    }

    const [matched] = remaining.splice(cardIndex, 1);
    return matched;
  }) as [CardCode, CardCode, CardCode, CardCode, CardCode];
}

function evaluateFiveCardHand(cards: [CardCode, CardCode, CardCode, CardCode, CardCode]): EvaluatedHand {
  const ranks = cards.map(getCardRankValue).sort((left, right) => right - left);
  const isFlush = new Set(cards.map(getCardSuitValue)).size === 1;
  const straightHighCard = getStraightHighCard(ranks);
  const grouped = [...new Set(ranks)]
    .map((rank) => ({
      rank,
      count: ranks.filter((value) => value === rank).length
    }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }

      return right.rank - left.rank;
    });

  if (isFlush && straightHighCard !== undefined) {
    return {
      category: "STRAIGHT_FLUSH",
      categoryValue: CATEGORY_VALUE_BY_NAME.STRAIGHT_FLUSH,
      label: `${RANK_NAME_BY_VALUE[straightHighCard]}-high straight flush`,
      comparisonValues: [straightHighCard],
      bestFiveCards: orderCardsForStraight(cards, straightHighCard)
    };
  }

  if (grouped[0]?.count === 4) {
    const fourRank = grouped[0].rank;
    const kicker = grouped[1]?.rank ?? 0;

    return {
      category: "FOUR_OF_A_KIND",
      categoryValue: CATEGORY_VALUE_BY_NAME.FOUR_OF_A_KIND,
      label: `Four of a kind, ${RANK_PLURAL_BY_VALUE[fourRank]}`,
      comparisonValues: [fourRank, kicker],
      bestFiveCards: orderCardsByRanks(cards, [fourRank, fourRank, fourRank, fourRank, kicker])
    };
  }

  if (grouped[0]?.count === 3 && grouped[1]?.count === 2) {
    const threeRank = grouped[0].rank;
    const pairRank = grouped[1].rank;

    return {
      category: "FULL_HOUSE",
      categoryValue: CATEGORY_VALUE_BY_NAME.FULL_HOUSE,
      label: `${RANK_PLURAL_BY_VALUE[threeRank]} full of ${RANK_PLURAL_BY_VALUE[pairRank]}`,
      comparisonValues: [threeRank, pairRank],
      bestFiveCards: orderCardsByRanks(cards, [threeRank, threeRank, threeRank, pairRank, pairRank])
    };
  }

  if (isFlush) {
    return {
      category: "FLUSH",
      categoryValue: CATEGORY_VALUE_BY_NAME.FLUSH,
      label: `${RANK_NAME_BY_VALUE[ranks[0] ?? 0]}-high flush`,
      comparisonValues: ranks,
      bestFiveCards: orderCardsByRanks(cards, ranks)
    };
  }

  if (straightHighCard !== undefined) {
    return {
      category: "STRAIGHT",
      categoryValue: CATEGORY_VALUE_BY_NAME.STRAIGHT,
      label: `${RANK_NAME_BY_VALUE[straightHighCard]}-high straight`,
      comparisonValues: [straightHighCard],
      bestFiveCards: orderCardsForStraight(cards, straightHighCard)
    };
  }

  if (grouped[0]?.count === 3) {
    const threeRank = grouped[0].rank;
    const kickers = grouped
      .slice(1)
      .map((group) => group.rank)
      .sort((left, right) => right - left);

    return {
      category: "THREE_OF_A_KIND",
      categoryValue: CATEGORY_VALUE_BY_NAME.THREE_OF_A_KIND,
      label: `Three of a kind, ${RANK_PLURAL_BY_VALUE[threeRank]}`,
      comparisonValues: [threeRank, ...kickers],
      bestFiveCards: orderCardsByRanks(cards, [threeRank, threeRank, threeRank, ...kickers])
    };
  }

  if (grouped[0]?.count === 2 && grouped[1]?.count === 2) {
    const highPair = Math.max(grouped[0].rank, grouped[1].rank);
    const lowPair = Math.min(grouped[0].rank, grouped[1].rank);
    const kicker = grouped[2]?.rank ?? 0;

    return {
      category: "TWO_PAIR",
      categoryValue: CATEGORY_VALUE_BY_NAME.TWO_PAIR,
      label: `Two pair, ${RANK_PLURAL_BY_VALUE[highPair]} and ${RANK_PLURAL_BY_VALUE[lowPair]}`,
      comparisonValues: [highPair, lowPair, kicker],
      bestFiveCards: orderCardsByRanks(cards, [highPair, highPair, lowPair, lowPair, kicker])
    };
  }

  if (grouped[0]?.count === 2) {
    const pairRank = grouped[0].rank;
    const kickers = grouped
      .slice(1)
      .map((group) => group.rank)
      .sort((left, right) => right - left);

    return {
      category: "ONE_PAIR",
      categoryValue: CATEGORY_VALUE_BY_NAME.ONE_PAIR,
      label: `One pair, ${RANK_PLURAL_BY_VALUE[pairRank]}`,
      comparisonValues: [pairRank, ...kickers],
      bestFiveCards: orderCardsByRanks(cards, [pairRank, pairRank, ...kickers])
    };
  }

  return {
    category: "HIGH_CARD",
    categoryValue: CATEGORY_VALUE_BY_NAME.HIGH_CARD,
    label: `${RANK_NAME_BY_VALUE[ranks[0] ?? 0]} high`,
    comparisonValues: ranks,
    bestFiveCards: orderCardsByRanks(cards, ranks)
  };
}

function evaluateSevenCardHand(
  cards: [CardCode, CardCode, CardCode, CardCode, CardCode, CardCode, CardCode]
) {
  let bestHand: EvaluatedHand | undefined;

  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            const nextHand = evaluateFiveCardHand([
              cards[a],
              cards[b],
              cards[c],
              cards[d],
              cards[e]
            ]);

            if (!bestHand || compareEvaluatedHands(nextHand, bestHand) > 0) {
              bestHand = nextHand;
            }
          }
        }
      }
    }
  }

  if (!bestHand) {
    throw new Error("Unable to evaluate a showdown hand.");
  }

  return bestHand;
}

function buildSettlementPots(players: HoldemSettlementPlayerState[], seatOrder: number[]) {
  const contributors = players.filter((player) => player.totalCommitted > 0);
  const contributionLevels = [...new Set(contributors.map((player) => player.totalCommitted))].sort(
    (left, right) => left - right
  );
  const pots: Array<
    Omit<
      HoldemSettlementPot,
      "rakeApplied" | "winnerSeatIndexes" | "oddChipSeatIndexes" | "awards"
    >
  > = [];
  let previousLevel = 0;

  for (const level of contributionLevels) {
    const potContributors = contributors.filter((player) => player.totalCommitted >= level);
    const amount = (level - previousLevel) * potContributors.length;

    if (amount > 0) {
      pots.push({
        potIndex: pots.length,
        potType: pots.length === 0 ? "MAIN" : "SIDE",
        capLevel: level,
        amount,
        contributorSeatIndexes: sortSeatIndexesBySeatOrder(
          potContributors.map((player) => player.seatIndex),
          seatOrder
        ),
        eligibleSeatIndexes: sortSeatIndexesBySeatOrder(
          potContributors
            .filter((player) => player.status !== "FOLDED")
            .map((player) => player.seatIndex),
          seatOrder
        )
      });
    }

    previousLevel = level;
  }

  return pots;
}

function getOddChipRecipients(
  winnerSeatIndexes: number[],
  oddChipCount: number,
  buttonSeatIndex: number | undefined,
  seatOrder: number[]
) {
  if (oddChipCount <= 0 || winnerSeatIndexes.length === 0) {
    return [];
  }

  const clockwiseSeatOrder =
    buttonSeatIndex === undefined
      ? [...seatOrder]
      : getClockwiseSeatOrderFrom(buttonSeatIndex, seatOrder).slice(1).concat(buttonSeatIndex);
  const orderedWinners = sortSeatIndexesBySeatOrder(
    winnerSeatIndexes,
    clockwiseSeatOrder.filter((seatIndex) => seatOrder.includes(seatIndex))
  );

  return orderedWinners.slice(0, oddChipCount);
}

function createPotAwards(
  potAmount: number,
  winnerSeatIndexes: number[],
  buttonSeatIndex: number | undefined,
  seatOrder: number[],
  participantsBySeat: Map<number, HoldemSettlementPlayerState>
) {
  if (winnerSeatIndexes.length === 0) {
    throw new Error("Settlement cannot split a pot without winners.");
  }

  const amountPerWinner = Math.floor(potAmount / winnerSeatIndexes.length);
  const oddChipCount = potAmount % winnerSeatIndexes.length;
  const oddChipSeatIndexes = getOddChipRecipients(
    winnerSeatIndexes,
    oddChipCount,
    buttonSeatIndex,
    seatOrder
  );
  const awards = sortSeatIndexesBySeatOrder(winnerSeatIndexes, seatOrder).map((seatIndex) => ({
    seatIndex,
    participantId: participantsBySeat.get(seatIndex)?.participantId ?? "",
    amount: amountPerWinner + (oddChipSeatIndexes.includes(seatIndex) ? 1 : 0)
  }));

  return { awards, oddChipSeatIndexes };
}

export function settleHoldemHand(
  input: HoldemSettlementInput,
  options: {
    oddChipRule?: HoldemOddChipRule;
    rakeConfig?: HoldemRakeConfig;
  } = {}
): HoldemHandSettlement {
  const oddChipRule = options.oddChipRule ?? "LEFT_OF_BUTTON";
  const rakeConfig = normalizeRakeConfig(
    options.rakeConfig ?? {
      enabled: false,
      percent: 0,
      cap: 0,
      mode: "PER_HAND"
    }
  );
  const participantsBySeat = new Map(input.players.map((player) => [player.seatIndex, player]));
  const showdownResults =
    input.board.length === 5
      ? sortSeatIndexesBySeatOrder(
          input.players
            .filter((player) => player.status !== "FOLDED" && player.totalCommitted > 0)
            .map((player) => player.seatIndex),
          input.seatOrder
        ).map((seatIndex) => {
          const player = participantsBySeat.get(seatIndex);

          if (!player) {
            throw new Error("Showdown player disappeared during settlement.");
          }

          const rank = evaluateSevenCardHand([
            player.holeCards[0],
            player.holeCards[1],
            input.board[0]!,
            input.board[1]!,
            input.board[2]!,
            input.board[3]!,
            input.board[4]!
          ]);

          return {
            seatIndex: player.seatIndex,
            participantId: player.participantId,
            holeCards: player.holeCards,
            rank: {
              category: rank.category,
              label: rank.label,
              comparisonValues: rank.comparisonValues,
              bestFiveCards: rank.bestFiveCards
            }
          } satisfies HoldemShowdownResult;
        })
      : [];
  const showdownBySeat = new Map(showdownResults.map((result) => [result.seatIndex, result]));
  const builtPots = buildSettlementPots(input.players, input.seatOrder);
  const payoutBySeat = new Map<number, number>();
  const pots: HoldemSettlementPot[] = [];
  let remainingRakeCap = rakeConfig.enabled ? rakeConfig.cap : 0;
  let totalRake = 0;
  const awardedByFold = input.winnerByFoldSeatIndex !== undefined;

  for (const builtPot of builtPots) {
    let winnerSeatIndexes: number[] = [];

    if (awardedByFold) {
      winnerSeatIndexes = builtPot.eligibleSeatIndexes.includes(input.winnerByFoldSeatIndex!)
        ? [input.winnerByFoldSeatIndex!]
        : builtPot.eligibleSeatIndexes.slice(0, 1);
    } else {
      const eligibleShowdowns = builtPot.eligibleSeatIndexes
        .map((seatIndex) => showdownBySeat.get(seatIndex))
        .filter((result): result is HoldemShowdownResult => Boolean(result));
      const bestResult = eligibleShowdowns.reduce<HoldemShowdownResult | undefined>(
        (best, candidate) => {
          if (!best) {
            return candidate;
          }

          return comparePublicRanks(candidate.rank, best.rank) > 0 ? candidate : best;
        },
        undefined
      );

      winnerSeatIndexes = eligibleShowdowns
        .filter((result) => bestResult && comparePublicRanks(result.rank, bestResult.rank) === 0)
        .map((result) => result.seatIndex);
    }

    winnerSeatIndexes = sortSeatIndexesBySeatOrder(winnerSeatIndexes, input.seatOrder);

    const rawRake =
      rakeConfig.enabled && remainingRakeCap > 0
        ? Math.min(Math.floor((builtPot.amount * rakeConfig.percent) / 100), remainingRakeCap)
        : 0;
    const rakeApplied = Math.max(0, Math.min(rawRake, builtPot.amount));
    remainingRakeCap -= rakeApplied;
    totalRake += rakeApplied;

    const { awards, oddChipSeatIndexes } = createPotAwards(
      builtPot.amount - rakeApplied,
      winnerSeatIndexes,
      input.buttonSeatIndex,
      input.seatOrder,
      participantsBySeat
    );

    for (const award of awards) {
      payoutBySeat.set(award.seatIndex, (payoutBySeat.get(award.seatIndex) ?? 0) + award.amount);
    }

    pots.push({
      ...builtPot,
      rakeApplied,
      winnerSeatIndexes,
      oddChipSeatIndexes,
      awards
    });
  }

  const playerResults = sortSeatIndexesBySeatOrder(
    input.players.map((player) => player.seatIndex),
    input.seatOrder
  ).map((seatIndex) => {
    const player = participantsBySeat.get(seatIndex);

    if (!player) {
      throw new Error("Settlement player disappeared.");
    }

    const won = payoutBySeat.get(seatIndex) ?? 0;
    const finalStack = player.stack + won;

    return {
      seatIndex,
      participantId: player.participantId,
      contributed: player.totalCommitted,
      won,
      finalStack,
      netResult: finalStack - player.startingStack
    } satisfies HoldemSettlementPlayerResult;
  });

  return {
    handId: input.handId,
    handNumber: input.handNumber,
    oddChipRule,
    rakeConfig,
    totalPot: input.potTotal,
    totalRake,
    awardedByFold,
    showdownResults,
    pots,
    playerResults
  };
}

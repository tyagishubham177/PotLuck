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

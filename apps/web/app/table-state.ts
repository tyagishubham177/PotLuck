import type {
  ActiveHandSnapshot,
  RoomActionAffordances,
  RoomPrivateState,
  RoomRealtimeSnapshot
} from "@potluck/contracts";

export type TableActionType = "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";

export type QuickAction = {
  actionType: Extract<TableActionType, "FOLD" | "CHECK" | "CALL" | "ALL_IN">;
  label: string;
  tone: "ghost" | "secondary" | "primary";
};

export type SizingAction = {
  actionType: Extract<TableActionType, "BET" | "RAISE">;
  label: string;
  min: number;
  max: number;
  presets: number[];
};

export type ActionTrayState = {
  quickActions: QuickAction[];
  sizingAction: SizingAction | null;
};

export type TableSeatViewModel = {
  seatIndex: number;
  positionClass: string;
  title: string;
  occupant: string;
  stackLabel: string;
  detailLabel: string;
  badgeLabel?: string;
  timerLabel?: string;
  isHero: boolean;
  isActing: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  isDisconnected: boolean;
  isReady: boolean;
  isSittingOut: boolean;
  hasPrivateCards: boolean;
  showCardBacks: boolean;
  statusTone: "empty" | "reserved" | "occupied" | "hero" | "warning" | "muted";
};

const seatPositionClasses = [
  "seat-position-0",
  "seat-position-1",
  "seat-position-2",
  "seat-position-3",
  "seat-position-4",
  "seat-position-5",
  "seat-position-6",
  "seat-position-7",
  "seat-position-8"
] as const;

export function formatChips(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return "n/a";
  }

  return `${amount.toLocaleString()} chips`;
}

export function formatCountdown(expiresAt: string, nowMs: number) {
  const totalSeconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - nowMs) / 1000));

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function getDefaultActionAmount(affordances?: RoomActionAffordances | null) {
  if (!affordances) {
    return "";
  }

  if (
    affordances.minRaiseTo !== undefined &&
    affordances.maxRaiseTo !== undefined &&
    affordances.maxRaiseTo >= affordances.minRaiseTo
  ) {
    const preset = affordances.presetAmounts.find(
      (amount) => amount >= affordances.minRaiseTo! && amount <= affordances.maxRaiseTo!
    );

    return String(preset ?? affordances.minRaiseTo);
  }

  if (affordances.allInAmount !== undefined) {
    return String(affordances.allInAmount);
  }

  return "";
}

export function clampActionAmount(
  rawAmount: number,
  affordances?: RoomActionAffordances | null
) {
  const safeAmount = Number.isFinite(rawAmount) ? Math.trunc(rawAmount) : 0;

  if (!affordances) {
    return Math.max(0, safeAmount);
  }

  const floor = affordances.minRaiseTo ?? 0;
  const ceiling =
    affordances.maxRaiseTo ?? affordances.allInAmount ?? affordances.minRaiseTo ?? 0;

  if (ceiling <= 0) {
    return 0;
  }

  return Math.min(Math.max(safeAmount, floor), ceiling);
}

export function getActionTrayState(
  activeHand?: ActiveHandSnapshot | null,
  affordances?: RoomActionAffordances | null
): ActionTrayState {
  if (!affordances) {
    return {
      quickActions: [],
      sizingAction: null
    };
  }

  const quickActions: QuickAction[] = [];

  if (affordances.canFold) {
    quickActions.push({
      actionType: "FOLD",
      label: "Fold",
      tone: "ghost"
    });
  }

  if (affordances.canCheck) {
    quickActions.push({
      actionType: "CHECK",
      label: "Check",
      tone: "secondary"
    });
  } else if ((affordances.callAmount ?? 0) > 0) {
    quickActions.push({
      actionType: "CALL",
      label: `Call ${formatChips(affordances.callAmount)}`,
      tone: "primary"
    });
  }

  const canSize =
    affordances.minRaiseTo !== undefined &&
    affordances.maxRaiseTo !== undefined &&
    affordances.maxRaiseTo >= affordances.minRaiseTo;

  if ((affordances.allInAmount ?? 0) > 0) {
    quickActions.push({
      actionType: "ALL_IN",
      label: `All-in ${formatChips(affordances.allInAmount)}`,
      tone: canSize ? "secondary" : "primary"
    });
  }

  return {
    quickActions,
    sizingAction: canSize
      ? {
          actionType: (activeHand?.currentBet ?? 0) > 0 ? "RAISE" : "BET",
          label: (activeHand?.currentBet ?? 0) > 0 ? "Raise to" : "Bet to",
          min: affordances.minRaiseTo!,
          max: affordances.maxRaiseTo!,
          presets: [...new Set(
            affordances.presetAmounts.filter(
              (amount) => amount >= affordances.minRaiseTo! && amount <= affordances.maxRaiseTo!
            )
          )]
        }
      : null
  };
}

export function buildSeatViewModels(
  snapshot: RoomRealtimeSnapshot,
  privateState: RoomPrivateState | null,
  nowMs: number
) {
  const activePlayersBySeat = new Map(
    (snapshot.activeHand?.players ?? []).map((player) => [player.seatIndex, player])
  );
  const participantsById = new Map(
    snapshot.participants.map((participant) => [participant.participantId, participant])
  );

  return snapshot.seats.map<TableSeatViewModel>((seat) => {
    const handPlayer = activePlayersBySeat.get(seat.seatIndex);
    const participant = seat.participantId
      ? participantsById.get(seat.participantId)
      : undefined;
    const isHero = Boolean(
      seat.participantId && seat.participantId === privateState?.participantId
    );
    const isActing = snapshot.activeHand?.actingSeatIndex === seat.seatIndex;
    const isFolded = handPlayer?.status === "FOLDED";
    const isAllIn = handPlayer?.status === "ALL_IN";
    const isDisconnected = participant ? !participant.isConnected : false;
    const badgeLabel =
      snapshot.activeHand?.buttonSeatIndex === seat.seatIndex
        ? "D"
        : snapshot.activeHand?.smallBlindSeatIndex === seat.seatIndex
          ? "SB"
          : snapshot.activeHand?.bigBlindSeatIndex === seat.seatIndex
            ? "BB"
            : undefined;

    const detailBits = [
      participant?.isReady ? "Ready" : null,
      participant?.isSittingOut ? "Sitting out" : null,
      isDisconnected ? "Offline" : null,
      isFolded ? "Folded" : null,
      isAllIn ? "All-in" : null,
      handPlayer && handPlayer.streetCommitted > 0
        ? `In for ${handPlayer.streetCommitted.toLocaleString()}`
        : null
    ].filter(Boolean);

    return {
      seatIndex: seat.seatIndex,
      positionClass: seatPositionClasses[seat.seatIndex],
      title: `Seat ${seat.seatIndex + 1}`,
      occupant: seat.nickname ?? (seat.status === "EMPTY" ? "Open" : seat.status),
      stackLabel:
        seat.stack !== undefined
          ? formatChips(seat.stack)
          : seat.reservedUntil
            ? `Reserved ${formatCountdown(seat.reservedUntil, nowMs)}`
            : seat.status === "EMPTY"
              ? "Tap to reserve"
              : "Waiting",
      detailLabel:
        detailBits.join(" • ") ||
        (participant?.state ? participant.state.replaceAll("_", " ") : "Waiting"),
      badgeLabel,
      timerLabel:
        isActing && snapshot.activeHand
          ? formatCountdown(snapshot.activeHand.deadlineAt, nowMs)
          : undefined,
      isHero,
      isActing,
      isFolded,
      isAllIn,
      isDisconnected,
      isReady: participant?.isReady ?? false,
      isSittingOut: participant?.isSittingOut ?? false,
      hasPrivateCards: isHero && Boolean(privateState?.holeCards?.length),
      showCardBacks: Boolean(snapshot.activeHand && handPlayer && !isFolded),
      statusTone:
        isHero
          ? "hero"
          : isActing
            ? "warning"
            : seat.status === "EMPTY"
              ? "empty"
              : seat.status === "RESERVED"
                ? "reserved"
                : seat.status === "OCCUPIED"
                  ? "occupied"
                  : "muted"
    };
  });
}

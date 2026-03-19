import { formatChips } from "../../table-state";

import { ProcessNotice } from "../common/ProcessNotice";

import type { ChipOperation, ProcessFeedback } from "../../lib/phase-two-types";
import type { LobbySnapshot, RoomRealtimeSnapshot } from "@potluck/contracts";

type StackControlPanelProps = {
  chipControlState: {
    canBuyIn: boolean;
    canTopUp: boolean;
    canRebuy: boolean;
  };
  chipFeedback: ProcessFeedback | null;
  currentSeatSnapshot: RoomRealtimeSnapshot["seats"][number] | null;
  currentTablePhase: RoomRealtimeSnapshot["tablePhase"];
  heroSeatIndex: number | undefined;
  stackAmount: string;
  stackControlQuote: LobbySnapshot["buyInQuote"] | null;
  onChipOperation: (operation: ChipOperation) => void;
  onStackAmountChange: (value: string) => void;
};

export function StackControlPanel({
  chipControlState,
  chipFeedback,
  currentSeatSnapshot,
  currentTablePhase,
  heroSeatIndex,
  stackAmount,
  stackControlQuote,
  onChipOperation,
  onStackAmountChange
}: StackControlPanelProps) {
  return (
    <div className="stack-control-panel">
      <div className="panel-head compact">
        <p className="eyebrow">Between hands</p>
        <h3>Chip controls</h3>
      </div>
      <label className="field">
        <span>Chip amount</span>
        <input
          inputMode="numeric"
          onChange={(event) => onStackAmountChange(event.target.value)}
          value={stackAmount}
        />
      </label>
      {stackControlQuote ? (
        <div className="preset-row">
          <button
            className="mode-chip"
            onClick={() => onStackAmountChange(String(stackControlQuote.minChips))}
            type="button"
          >
            Min {formatChips(stackControlQuote.minChips, { compact: true })}
          </button>
          <button
            className="mode-chip"
            onClick={() =>
              onStackAmountChange(
                String(
                  Math.min(
                    stackControlQuote.maxChips,
                    Math.max(
                      stackControlQuote.minChips,
                      (currentSeatSnapshot?.stack ?? 0) + stackControlQuote.bigBlind * 20
                    )
                  )
                )
              )
            }
            type="button"
          >
            Top-up target
          </button>
          <button
            className="mode-chip"
            onClick={() => onStackAmountChange(String(stackControlQuote.maxChips))}
            type="button"
          >
            Max {formatChips(stackControlQuote.maxChips, { compact: true })}
          </button>
        </div>
      ) : null}

      <div className="tray-button-row">
        {chipControlState.canBuyIn ? (
          <button
            className="primary-button tray-action-button"
            onClick={() => onChipOperation("BUY_IN")}
            type="button"
          >
            Commit buy-in
          </button>
        ) : null}
        {chipControlState.canTopUp ? (
          <button
            className="secondary-button tray-action-button"
            onClick={() => onChipOperation("TOP_UP")}
            type="button"
          >
            Top up
          </button>
        ) : null}
        {chipControlState.canRebuy ? (
          <button
            className="secondary-button tray-action-button"
            onClick={() => onChipOperation("REBUY")}
            type="button"
          >
            Rebuy
          </button>
        ) : null}
      </div>
      <ProcessNotice feedback={chipFeedback} />

      {!chipControlState.canBuyIn && !chipControlState.canTopUp && !chipControlState.canRebuy ? (
        <p className="panel-copy">
          {heroSeatIndex === undefined
            ? "Reserve a seat first so stack controls can target the right chair."
            : currentTablePhase === "HAND_ACTIVE"
              ? "Top-up and rebuy controls unlock between hands so the live hand stays stable."
              : "Stack controls will appear here when your seat state allows them."}
        </p>
      ) : null}
    </div>
  );
}

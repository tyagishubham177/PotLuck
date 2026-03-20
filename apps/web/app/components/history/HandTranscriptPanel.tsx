import { formatChips } from "../../table-state";

import type { HandTranscript, SettlementPostedEvent } from "@potluck/contracts";

type HandTranscriptPanelProps = {
  handHistory: HandTranscript | null;
  settlementSummary: SettlementPostedEvent["settlement"] | null;
  onExportHand: (handId: string, format: "json" | "txt") => void;
  onRequestLatestHistory: () => void;
};

export function HandTranscriptPanel({
  handHistory,
  settlementSummary,
  onExportHand,
  onRequestLatestHistory
}: HandTranscriptPanelProps) {
  return (
    <div className="info-block">
      <div className="panel-head compact">
        <p className="eyebrow">Transcript</p>
        <h3>{handHistory ? `Hand ${handHistory.handNumber}` : "Select a hand"}</h3>
      </div>
      {handHistory ? (
        <>
          <div className="info-row">
            <span>Actions</span>
            <strong>{handHistory.actions.length}</strong>
          </div>
          <div className="info-row">
            <span>Board</span>
            <strong>{handHistory.board.join(" ") || "No board"}</strong>
          </div>
          <div className="info-row">
            <span>Audit events</span>
            <strong>{handHistory.auditEvents.length}</strong>
          </div>
          <div className="info-row">
            <span>Total pot</span>
            <strong>{formatChips(handHistory.settlement.totalPot)}</strong>
          </div>
          <div className="history-detail-list">
            {handHistory.actions.map((action) => (
              <div className="history-detail-row" key={`${handHistory.handId}-${action.seq}`}>
                <span>
                  #{action.seq} Seat {action.seatIndex + 1} {action.actionType}
                </span>
                <strong>{formatChips(action.normalizedAmount ?? action.contributedAmount)}</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="panel-copy">
          Pick a completed hand to inspect the action stream, board, and settlement.
        </p>
      )}

      <div className="action-row">
        <button
          className="secondary-button"
          disabled={!settlementSummary}
          onClick={onRequestLatestHistory}
          type="button"
        >
          Load transcript
        </button>
        {handHistory ? (
          <>
            <button
              className="ghost-button"
              onClick={() => onExportHand(handHistory.handId, "json")}
              type="button"
            >
              Export JSON
            </button>
            <button
              className="ghost-button"
              onClick={() => onExportHand(handHistory.handId, "txt")}
              type="button"
            >
              Export text
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

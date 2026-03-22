import type { HandHistorySummary, SettlementPostedEvent } from "@potluck/contracts";
import type { ProcessFeedback } from "../../lib/phase-two-types";

import { ProcessNotice } from "../common/ProcessNotice";

type HandHistoryPanelProps = {
  activeHandId?: string;
  historyFeedback: ProcessFeedback | null;
  historyItems: HandHistorySummary[];
  historyNextCursor: string | null;
  settlementSummary: SettlementPostedEvent["settlement"] | null;
  onLoadHandTranscript: (handId: string) => void;
  onLoadHistoryList: (options?: { append?: boolean; cursor?: string }) => void;
  onRequestLatestHistory: () => void;
};

function formatDelta(value: number) {
  return `${value >= 0 ? "▲ +" : "▼ "}${Math.abs(value).toLocaleString()}`;
}

export function HandHistoryPanel({
  activeHandId,
  historyFeedback,
  historyItems,
  historyNextCursor,
  settlementSummary,
  onLoadHandTranscript,
  onLoadHistoryList,
  onRequestLatestHistory
}: HandHistoryPanelProps) {
  return (
    <div className="info-block">
      <div className="panel-head compact">
        <p className="eyebrow">History</p>
        <h3>{historyItems.length} completed hands</h3>
      </div>
      <ProcessNotice feedback={historyFeedback} />

      {historyItems.length ? (
        <div className="history-list">
          {historyItems.map((item) => (
            <button
              aria-current={activeHandId === item.handId ? "true" : undefined}
              className={`history-item${activeHandId === item.handId ? " active" : ""}`}
              key={item.handId}
              onClick={() => onLoadHandTranscript(item.handId)}
              type="button"
            >
              <div className="history-item-head">
                <strong>Hand {item.handNumber}</strong>
                <span>{new Date(item.endedAt).toLocaleTimeString()}</span>
              </div>
              <small>{item.playerNames.join(", ")}</small>
              <div className="history-delta-row">
                {item.stackDeltas
                  .slice()
                  .sort((left, right) => right.netResult - left.netResult)
                  .map((result) => (
                    <span
                      className={result.netResult >= 0 ? "delta-positive" : "delta-negative"}
                      key={`${item.handId}-${result.participantId}`}
                    >
                      {result.nickname} {formatDelta(result.netResult)}
                    </span>
                  ))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="panel-copy">No completed hands yet. This list will fill as settlements finalize.</p>
      )}

      <div className="action-row">
        <button className="secondary-button" onClick={() => onLoadHistoryList()} type="button">
          Refresh history
        </button>
        {historyNextCursor ? (
          <button
            className="ghost-button"
            onClick={() => onLoadHistoryList({ cursor: historyNextCursor, append: true })}
            type="button"
          >
            Load more
          </button>
        ) : null}
        {settlementSummary ? (
          <button className="ghost-button" onClick={onRequestLatestHistory} type="button">
            Latest via socket
          </button>
        ) : null}
      </div>
    </div>
  );
}

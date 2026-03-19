import { CardFace } from "../common/CardFace";

import type { RoomRealtimeSnapshot, SettlementPostedEvent, ShowdownResultEvent } from "@potluck/contracts";

type ShowdownPanelProps = {
  liveSnapshot: RoomRealtimeSnapshot | null;
  settlementSummary: SettlementPostedEvent["settlement"] | null;
  showdownResult: ShowdownResultEvent | null;
  showdownWinners: Set<number>;
};

function formatDelta(value: number) {
  return `${value >= 0 ? "▲ +" : "▼ "}${Math.abs(value).toLocaleString()}`;
}

export function ShowdownPanel({
  liveSnapshot,
  settlementSummary,
  showdownResult,
  showdownWinners
}: ShowdownPanelProps) {
  return (
    <div className="info-block">
      <div className="panel-head compact">
        <p className="eyebrow">Showdown</p>
        <h3>{settlementSummary ? `Hand ${settlementSummary.handNumber}` : "Waiting for result"}</h3>
      </div>

      {showdownResult ? (
        <div className="showdown-grid">
          {showdownResult.results.map((result) => (
            <div
              className={`showdown-card${showdownWinners.has(result.seatIndex) ? " is-winning" : ""}`}
              key={result.participantId}
            >
              <div className="showdown-head">
                <span>
                  Seat {result.seatIndex + 1} |{" "}
                  {liveSnapshot?.seats[result.seatIndex]?.nickname ?? result.participantId}
                </span>
                <strong>{result.rank.label}</strong>
              </div>
              <div className="showdown-cards">
                {result.holeCards.map((card) => (
                  <CardFace
                    card={card}
                    key={`${result.participantId}-${card}`}
                    winning={showdownWinners.has(result.seatIndex)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="panel-copy">Winning cards and pot splits will stay here until the next hand starts.</p>
      )}

      {settlementSummary ? (
        <div className="settlement-list">
          {settlementSummary.playerResults
            .slice()
            .sort((left, right) => right.netResult - left.netResult)
            .map((result) => (
              <div className="settlement-row" key={result.participantId}>
                <span>
                  Seat {result.seatIndex + 1} |{" "}
                  {liveSnapshot?.seats[result.seatIndex]?.nickname ?? result.participantId}
                </span>
                <strong className={result.netResult >= 0 ? "delta-positive" : "delta-negative"}>
                  {formatDelta(result.netResult)}
                </strong>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

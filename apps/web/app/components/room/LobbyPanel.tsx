import { formatChips, formatCountdown } from "../../table-state";

import { EmptyState } from "../common/EmptyState";
import { InfoRow } from "../common/InfoRow";
import { ProcessButton } from "../common/ProcessButton";
import { ProcessNotice } from "../common/ProcessNotice";

import type { AuthState, ProcessFeedback } from "../../lib/phase-two-types";
import type { LobbySnapshot } from "@potluck/contracts";

type LobbyPanelProps = {
  authState: AuthState;
  copyRoomCodeFeedback: ProcessFeedback | null;
  heroParticipantState: string;
  lobbyFeedback: ProcessFeedback | null;
  lobbySnapshot: LobbySnapshot | null;
  nowMs: number;
  queueFeedback: ProcessFeedback | null;
  reserveFeedback: ProcessFeedback | null;
  stackAmount: string;
  stackControlQuote: LobbySnapshot["buyInQuote"] | null;
  onCopyRoomCode: () => void;
  onJoinQueue: () => void;
  onRefreshLobby: () => void;
  onReserveSeat: (seatIndex: number) => void;
  onStackAmountChange: (value: string) => void;
};

export function LobbyPanel({
  authState,
  copyRoomCodeFeedback,
  heroParticipantState,
  lobbyFeedback,
  lobbySnapshot,
  nowMs,
  queueFeedback,
  reserveFeedback,
  stackAmount,
  stackControlQuote,
  onCopyRoomCode,
  onJoinQueue,
  onRefreshLobby,
  onReserveSeat,
  onStackAmountChange
}: LobbyPanelProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <p className="eyebrow">Lobby</p>
        <h2>Reserve a seat, copy the code, and watch the queue move</h2>
      </div>

      <div className="action-row">
        <ProcessButton
          disabled={!lobbySnapshot}
          idleLabel="Refresh lobby"
          onClick={onRefreshLobby}
          pendingLabel="Refreshing lobby"
          successLabel="Lobby refreshed"
          tone={lobbyFeedback?.tone ?? "idle"}
          variant="secondary"
        />
        {lobbySnapshot ? (
          <button className="room-code-pill" onClick={onCopyRoomCode} type="button">
            <span>Room code</span>
            <strong>{lobbySnapshot.room.code}</strong>
          </button>
        ) : null}
      </div>
      <ProcessNotice feedback={lobbyFeedback} />
      <ProcessNotice feedback={copyRoomCodeFeedback} />
      <ProcessNotice feedback={reserveFeedback} />
      <ProcessNotice feedback={queueFeedback} />

      {lobbySnapshot ? (
        <>
          <div className="info-block">
            <InfoRow label="Table" value={lobbySnapshot.room.tableName} />
            <InfoRow
              label="Buy-in range"
              value={`${lobbySnapshot.buyInQuote.displayMin} to ${lobbySnapshot.buyInQuote.displayMax}`}
            />
            <InfoRow label="Hero state" value={heroParticipantState} />
          </div>

          {authState?.actor.role === "GUEST" && authState.actor.mode === "PLAYER" && stackControlQuote ? (
            <div className="info-block">
              <div className="panel-head compact">
                <p className="eyebrow">Sit-in</p>
                <h3>Choose chips before you tap a seat</h3>
                <p className="panel-copy">
                  We reserve the chair and post the buy-in in one step, then you can hit Play.
                </p>
              </div>
              <label className="field">
                <span>Sit-in amount</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => onStackAmountChange(event.target.value)}
                  value={stackAmount}
                />
              </label>
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
                      String(Math.round((stackControlQuote.minChips + stackControlQuote.maxChips) / 2))
                    )
                  }
                  type="button"
                >
                  Mid stack
                </button>
                <button
                  className="mode-chip"
                  onClick={() => onStackAmountChange(String(stackControlQuote.maxChips))}
                  type="button"
                >
                  Max {formatChips(stackControlQuote.maxChips, { compact: true })}
                </button>
              </div>
            </div>
          ) : null}

          <div className="seat-grid">
            {lobbySnapshot.seats.map((seat) => {
              const canReserve =
                seat.status === "EMPTY" &&
                authState?.actor.role === "GUEST" &&
                authState.actor.mode === "PLAYER" &&
                !lobbySnapshot.heroSeatIndex;

              return (
                <button
                  aria-label={canReserve ? `Reserve seat ${seat.seatIndex + 1}` : `Seat ${seat.seatIndex + 1}`}
                  className={`seat-card seat-${seat.status.toLowerCase()}`}
                  disabled={!canReserve}
                  key={seat.seatIndex}
                  onClick={() => (canReserve ? onReserveSeat(seat.seatIndex) : undefined)}
                  type="button"
                >
                  <span>Seat {seat.seatIndex + 1}</span>
                  <strong>{seat.nickname ?? seat.status}</strong>
                  {seat.reservedUntil ? (
                    <small>Countdown {formatCountdown(seat.reservedUntil, nowMs)}</small>
                  ) : (
                    <small>{seat.status === "EMPTY" ? "Tap to sit with your selected amount" : "Unavailable"}</small>
                  )}
                </button>
              );
            })}
          </div>

          {lobbySnapshot.canJoinWaitingList ? (
            <div className="action-row">
              <ProcessButton
                idleLabel="Join waiting list"
                onClick={onJoinQueue}
                pendingLabel="Joining queue"
                successLabel="Queue joined"
                tone={queueFeedback?.tone ?? "idle"}
                variant="primary"
              />
            </div>
          ) : null}

          <div className="subpanel-grid">
            <div className="info-block">
              <div className="panel-head compact">
                <p className="eyebrow">Participants</p>
                <h3>{lobbySnapshot.participants.length} active</h3>
              </div>
              <ul className="participant-list">
                {lobbySnapshot.participants.map((participant) => (
                  <li key={participant.participantId}>
                    <span>{participant.nickname}</span>
                    <small>
                      {participant.state}
                      {participant.queuePosition ? ` | Q${participant.queuePosition}` : ""}
                      {participant.seatIndex !== undefined ? ` | Seat ${participant.seatIndex + 1}` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            </div>

            <div className="info-block">
              <div className="panel-head compact">
                <p className="eyebrow">Waiting list</p>
                <h3>{lobbySnapshot.waitingList.length} queued</h3>
              </div>
              {lobbySnapshot.waitingList.length ? (
                <ul className="participant-list">
                  {lobbySnapshot.waitingList.map((entry) => (
                    <li key={entry.entryId}>
                      <span>{entry.nickname}</span>
                      <small>Position {entry.position}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-copy">
                  No one is queued yet. The table needs at least two ready players before the next
                  hand can begin.
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          description="Create a room as host or join one by code to pull the latest lobby snapshot."
          eyebrow="Ready when you are"
          muted
          title="No lobby loaded yet"
        />
      )}
    </article>
  );
}

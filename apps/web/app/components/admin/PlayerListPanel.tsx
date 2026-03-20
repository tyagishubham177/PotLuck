import { formatCountdown } from "../../table-state";

import type { RoomRealtimeSnapshot } from "@potluck/contracts";

type PlayerListPanelProps = {
  canKick: boolean;
  liveSnapshot: RoomRealtimeSnapshot | null;
  nowMs: number;
  onKickParticipant: (participantId: string, nicknameLabel: string) => void;
};

export function PlayerListPanel({
  canKick,
  liveSnapshot,
  nowMs,
  onKickParticipant
}: PlayerListPanelProps) {
  return (
    <div className="info-block">
      <div className="panel-head compact">
        <p className="eyebrow">Players</p>
        <h3>{liveSnapshot?.participants.length ?? 0} tracked</h3>
      </div>
      {liveSnapshot ? (
        <ul className="participant-list">
          {liveSnapshot.participants.map((participant) => (
            <li className="participant-line" key={participant.participantId}>
              <div>
                <span>{participant.nickname}</span>
                <small>
                  {participant.state}
                  {participant.isReady ? " | Ready" : ""}
                  {participant.isSittingOut ? " | Sitting out" : ""}
                  {!participant.isConnected ? " | Disconnected" : ""}
                  {participant.seatIndex !== undefined ? ` | Seat ${participant.seatIndex + 1}` : ""}
                  {!participant.isConnected && participant.reconnectGraceEndsAt
                    ? ` | Kick unlocks in ${formatCountdown(participant.reconnectGraceEndsAt, nowMs)}`
                    : ""}
                </small>
              </div>
              {canKick ? (
                (() => {
                  const kickLockedUntil = participant.reconnectGraceEndsAt
                    ? new Date(participant.reconnectGraceEndsAt).getTime()
                    : null;
                  const kickLocked = kickLockedUntil !== null && kickLockedUntil > nowMs;

                  return (
                    <button
                      className="ghost-button compact-button"
                      disabled={kickLocked}
                      onClick={() => {
                        if (!window.confirm(`Remove ${participant.nickname} from the room?`)) {
                          return;
                        }

                        onKickParticipant(participant.participantId, participant.nickname);
                      }}
                      type="button"
                    >
                      {kickLocked ? "Timer running" : "Kick"}
                    </button>
                  );
                })()
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel-copy">The live participant rail will populate after room subscribe.</p>
      )}
    </div>
  );
}

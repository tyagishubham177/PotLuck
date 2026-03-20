import { ProcessButton } from "../common/ProcessButton";
import { ProcessNotice } from "../common/ProcessNotice";

import type { RoomJoinMode } from "@potluck/contracts";
import type { ProcessFeedback } from "../../lib/phase-two-types";
import type { RoomPublicSummary } from "@potluck/contracts";

type GuestJoinPanelProps = {
  joinMode: RoomJoinMode;
  joinRoomFeedback: ProcessFeedback | null;
  lookupFeedback: ProcessFeedback | null;
  nickname: string;
  roomCode: string;
  roomPreview: RoomPublicSummary | null;
  onJoinModeChange: (value: RoomJoinMode) => void;
  onNicknameChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  onCheckRoom: () => void;
  onJoinRoom: () => void;
};

export function GuestJoinPanel({
  joinMode,
  joinRoomFeedback,
  lookupFeedback,
  nickname,
  roomCode,
  roomPreview,
  onJoinModeChange,
  onNicknameChange,
  onRoomCodeChange,
  onCheckRoom,
  onJoinRoom
}: GuestJoinPanelProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <p className="eyebrow">Join room</p>
        <h2>Enter by code as a player or spectator</h2>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Room code</span>
          <input
            onChange={(event) => onRoomCodeChange(event.target.value)}
            value={roomCode}
          />
        </label>
        <label className="field">
          <span>Nickname</span>
          <input
            onChange={(event) => onNicknameChange(event.target.value)}
            value={nickname}
          />
        </label>
      </div>

      <div aria-label="Join mode" className="mode-picker" role="radiogroup">
        <button
          aria-checked={joinMode === "PLAYER"}
          className={joinMode === "PLAYER" ? "mode-chip active" : "mode-chip"}
          onClick={() => onJoinModeChange("PLAYER")}
          role="radio"
          type="button"
        >
          Player
        </button>
        <button
          aria-checked={joinMode === "SPECTATOR"}
          className={joinMode === "SPECTATOR" ? "mode-chip active" : "mode-chip"}
          onClick={() => onJoinModeChange("SPECTATOR")}
          role="radio"
          type="button"
        >
          Spectator
        </button>
      </div>

      <div className="action-row">
        <ProcessButton
          idleLabel="Check room"
          onClick={onCheckRoom}
          pendingLabel="Checking room"
          successLabel="Room checked"
          tone={lookupFeedback?.tone ?? "idle"}
          variant="secondary"
        />
        <ProcessButton
          idleLabel="Join lobby"
          onClick={onJoinRoom}
          pendingLabel="Joining lobby"
          successLabel="Lobby joined"
          tone={joinRoomFeedback?.tone ?? "idle"}
          variant="primary"
        />
      </div>
      <ProcessNotice feedback={lookupFeedback} />
      <ProcessNotice feedback={joinRoomFeedback} />

      {roomPreview ? (
        <div className="stat-grid">
          <div className="stat-card">
            <span>Open seats</span>
            <strong>{roomPreview.openSeatCount}</strong>
          </div>
          <div className="stat-card">
            <span>Reserved</span>
            <strong>{roomPreview.reservedSeatCount}</strong>
          </div>
          <div className="stat-card">
            <span>Queue</span>
            <strong>{roomPreview.queuedCount}</strong>
          </div>
          <div className="stat-card">
            <span>Status</span>
            <strong>{roomPreview.status}</strong>
          </div>
        </div>
      ) : null}
    </article>
  );
}

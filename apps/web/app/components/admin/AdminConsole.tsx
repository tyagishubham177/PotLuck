import type { RoomConfig, RoomRealtimeSnapshot } from "@potluck/contracts";
import type { ProcessFeedback } from "../../lib/phase-two-types";

import { ProcessNotice } from "../common/ProcessNotice";
import { RoomConfigFields } from "../room/RoomConfigFields";
import { RoomFeatureChips } from "../room/RoomFeatureChips";

type AdminConsoleProps = {
  adminActionReason: string;
  adminFeedback: ProcessFeedback | null;
  liveSnapshot: RoomRealtimeSnapshot | null;
  roomForm: RoomConfig;
  updateRoomForm: <K extends keyof RoomConfig>(key: K, value: RoomConfig[K]) => void;
  onAdminActionReasonChange: (value: string) => void;
  onPauseResumeRoom: (nextAction: "pause" | "resume") => void;
  onSaveRoomConfig: () => void;
  onToggleJoinLock: (locked: boolean) => void;
};

export function AdminConsole({
  adminActionReason,
  adminFeedback,
  liveSnapshot,
  roomForm,
  updateRoomForm,
  onAdminActionReasonChange,
  onPauseResumeRoom,
  onSaveRoomConfig,
  onToggleJoinLock
}: AdminConsoleProps) {
  if (!liveSnapshot) {
    return null;
  }

  const nextPauseAction = liveSnapshot.room.status === "PAUSED" ? "resume" : "pause";

  return (
    <div className="info-block">
      <div className="panel-head compact">
        <p className="eyebrow">Admin console</p>
        <h3>{liveSnapshot.room.joinLocked ? "Room locked to joins" : "Room open to joins"}</h3>
      </div>
      <label className="field">
        <span>Reason / note</span>
        <input
          onChange={(event) => onAdminActionReasonChange(event.target.value)}
          value={adminActionReason}
        />
      </label>

      <div className="tray-button-row">
        <button
          className="secondary-button tray-action-button"
          onClick={() => {
            if (
              nextPauseAction === "pause" &&
              !window.confirm("Pause the room for all players?")
            ) {
              return;
            }

            onPauseResumeRoom(nextPauseAction);
          }}
          type="button"
        >
          {nextPauseAction === "resume" ? "Resume room" : "Pause room"}
        </button>
        <button
          className="ghost-button tray-action-button"
          onClick={() => onToggleJoinLock(!liveSnapshot.room.joinLocked)}
          type="button"
        >
          {liveSnapshot.room.joinLocked ? "Unlock joins" : "Lock joins"}
        </button>
        <button className="primary-button tray-action-button" onClick={onSaveRoomConfig} type="button">
          Save config
        </button>
      </div>
      <ProcessNotice feedback={adminFeedback} />
      <p className="panel-copy">
        Gameplay rules only update between hands. If a hand is active, the server will reject the
        edit with a timing note.
      </p>

      <RoomConfigFields roomForm={roomForm} updateRoomForm={updateRoomForm} variant="admin" />
      <RoomFeatureChips
        keys={["spectatorsAllowed", "waitingListEnabled", "rebuyEnabled", "topUpEnabled"]}
        roomForm={roomForm}
        updateRoomForm={updateRoomForm}
      />
    </div>
  );
}

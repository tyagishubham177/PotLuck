import { ProcessButton } from "../common/ProcessButton";
import { ProcessNotice } from "../common/ProcessNotice";
import { InfoRow } from "../common/InfoRow";
import { RoomConfigFields } from "./RoomConfigFields";
import { RoomFeatureChips } from "./RoomFeatureChips";

import type { RoomConfig } from "@potluck/contracts";
import type { ProcessFeedback } from "../../lib/phase-two-types";

type RoomCreatePanelProps = {
  roomForm: RoomConfig;
  derivedBuyInExample: string;
  createRoomFeedback: ProcessFeedback | null;
  canCreateRoom: boolean;
  updateRoomForm: <K extends keyof RoomConfig>(key: K, value: RoomConfig[K]) => void;
  onCreateRoom: () => void;
};

export function RoomCreatePanel({
  roomForm,
  derivedBuyInExample,
  createRoomFeedback,
  canCreateRoom,
  updateRoomForm,
  onCreateRoom
}: RoomCreatePanelProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <p className="eyebrow">Room setup</p>
        <h2>Create a table with clear blind and buy-in rules</h2>
      </div>

      <RoomConfigFields roomForm={roomForm} updateRoomForm={updateRoomForm} />
      <RoomFeatureChips roomForm={roomForm} updateRoomForm={updateRoomForm} />

      <div className="info-block">
        <InfoRow label="Derived minimum" value={derivedBuyInExample} />
        <InfoRow label="Seat reservation" value={`${roomForm.seatReservationTimeoutSeconds}s`} />
        <InfoRow label="Join code expiry" value={`${roomForm.joinCodeExpiryMinutes} min`} />
      </div>

      <div className="action-row">
        <ProcessButton
          disabled={!canCreateRoom}
          idleLabel="Create room"
          onClick={onCreateRoom}
          pendingLabel="Creating room"
          successLabel="Room created"
          tone={createRoomFeedback?.tone ?? "idle"}
          variant="primary"
        />
      </div>
      <ProcessNotice feedback={createRoomFeedback} />
    </article>
  );
}

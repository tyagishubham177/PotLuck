import { formatCountdown } from "../../table-state";

import { EmptyState } from "../common/EmptyState";
import { ProcessNotice } from "../common/ProcessNotice";

import type { ProcessFeedback } from "../../lib/phase-two-types";
import type { AdminActiveRoomSummary } from "@potluck/contracts";

type AdminRoomListPanelProps = {
  adminFeedback: ProcessFeedback | null;
  adminRooms: AdminActiveRoomSummary[];
  currentRoomId: string | null;
  nowMs: number;
  onCloseRoom: (roomId: string, roomLabel: string) => void;
  onLoadAdminRooms: () => void;
  onOpenRoom: (roomId: string) => void;
};

export function AdminRoomListPanel({
  adminFeedback,
  adminRooms,
  currentRoomId,
  nowMs,
  onCloseRoom,
  onLoadAdminRooms,
  onOpenRoom
}: AdminRoomListPanelProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <p className="eyebrow">Admin rooms</p>
        <h2>Open tables you can resume or close</h2>
      </div>

      <div className="action-row">
        <button className="secondary-button" onClick={onLoadAdminRooms} type="button">
          Refresh room list
        </button>
      </div>
      <ProcessNotice feedback={adminFeedback} />

      {adminRooms.length ? (
        <div className="admin-room-list">
          {adminRooms.map((item) => {
            const isCurrentRoom = item.room.roomId === currentRoomId;

            return (
              <div className="admin-room-card" key={item.room.roomId}>
                <div className="panel-head compact">
                  <p className="eyebrow">
                    {item.room.code} {isCurrentRoom ? "| Open now" : ""}
                  </p>
                  <h3>{item.room.tableName}</h3>
                  <p className="panel-copy">
                    {item.tablePhase === "HAND_ACTIVE" ? "Hand in progress." : "Between hands."}
                    {item.pausedReason ? ` Paused: ${item.pausedReason}` : ""}
                  </p>
                </div>

                <div className="info-block">
                  <div className="info-row">
                    <span>Status</span>
                    <strong>{item.room.status}</strong>
                  </div>
                  <div className="info-row">
                    <span>Players ready</span>
                    <strong>
                      {item.readyParticipantCount} / {item.room.participantCount}
                    </strong>
                  </div>
                  <div className="info-row">
                    <span>Connections</span>
                    <strong>{item.connectedParticipantCount} live</strong>
                  </div>
                  <div className="info-row">
                    <span>Room closes in</span>
                    <strong>{formatCountdown(item.room.closesAt, nowMs)}</strong>
                  </div>
                </div>

                <div className="tray-button-row">
                  <button
                    className="secondary-button tray-action-button"
                    disabled={isCurrentRoom}
                    onClick={() => onOpenRoom(item.room.roomId)}
                    type="button"
                  >
                    {isCurrentRoom ? "Viewing room" : "Open room"}
                  </button>
                  <button
                    className="ghost-button tray-action-button"
                    onClick={() => {
                      if (!window.confirm(`Close ${item.room.tableName} for everyone?`)) {
                        return;
                      }

                      onCloseRoom(item.room.roomId, item.room.tableName);
                    }}
                    type="button"
                  >
                    Close room
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          description="Sign in as admin, create a room, or refresh to check whether an earlier table is still open."
          eyebrow="No active rooms"
          muted
          title="Nothing is currently open for this admin"
        />
      )}
    </article>
  );
}

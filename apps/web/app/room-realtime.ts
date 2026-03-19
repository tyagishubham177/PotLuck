import {
  roomRealtimeSnapshotSchema,
  type RoomDiffPatch,
  type RoomRealtimeSnapshot
} from "@potluck/contracts";

export function toWebSocketUrl(serverOrigin: string) {
  const url = new URL(serverOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  return url.toString();
}

export function applyRoomDiff(
  current: RoomRealtimeSnapshot,
  diff: RoomDiffPatch,
  roomEventNo: number
) {
  if (roomEventNo <= current.roomEventNo) {
    return current;
  }

  return roomRealtimeSnapshotSchema.parse({
    ...current,
    ...diff,
    roomEventNo,
    activeHand:
      diff.activeHand === undefined
        ? current.activeHand
        : diff.activeHand ?? undefined,
    pausedReason:
      diff.pausedReason === undefined
        ? current.pausedReason
        : diff.pausedReason ?? undefined
  });
}

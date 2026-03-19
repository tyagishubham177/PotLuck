import {
  type AuthActor,
  roomRealtimeSnapshotSchema,
  type RoomDiffPatch,
  type RoomRealtimeSnapshot,
  type SessionEnvelope
} from "@potluck/contracts";

export type RoomScopedAuthState = {
  session: SessionEnvelope;
  actor: AuthActor;
} | null;

export const authSessionSyncStorageKey = "potluck.auth-session-sync";

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

function getGuestRoomScopeKey(authState: RoomScopedAuthState) {
  if (!authState || authState.actor.role !== "GUEST") {
    return null;
  }

  return `${authState.actor.roomId}:${authState.actor.guestId}:${authState.actor.roomCode}`;
}

function getAuthStateSyncScope(authState: RoomScopedAuthState) {
  if (!authState) {
    return "ANON";
  }

  if (authState.actor.role === "ADMIN") {
    return `ADMIN:${authState.actor.adminId}:${authState.session.sessionId}`;
  }

  return `GUEST:${authState.actor.roomId}:${authState.actor.guestId}:${authState.session.sessionId}`;
}

export function createAuthStateSyncMarker(
  authState: RoomScopedAuthState,
  changedAt = Date.now()
) {
  return JSON.stringify({
    changedAt,
    scope: getAuthStateSyncScope(authState)
  });
}

export function shouldRefreshAuthStateFromSyncMarker(
  currentAuthState: RoomScopedAuthState,
  marker: string | null
) {
  if (!marker) {
    return false;
  }

  try {
    const parsed = JSON.parse(marker) as { scope?: unknown };
    return (
      typeof parsed.scope !== "string" ||
      parsed.scope !== getAuthStateSyncScope(currentAuthState)
    );
  } catch {
    return true;
  }
}

export function shouldResetRoomState(
  previousAuthState: RoomScopedAuthState,
  nextAuthState: RoomScopedAuthState
) {
  return getGuestRoomScopeKey(previousAuthState) !== getGuestRoomScopeKey(nextAuthState);
}

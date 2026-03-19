"use client";

import { useEffect, useMemo, useState } from "react";

import {
  adminOtpRequestResponseSchema,
  apiErrorSchema,
  authSessionResponseSchema,
  authStatusResponseSchema,
  buyInQuoteResponseSchema,
  joinRoomResponseSchema,
  lobbySnapshotSchema,
  logoutResponseSchema,
  queueJoinResponseSchema,
  roomCreateResponseSchema,
  roomPublicSummarySchema,
  seatReservationResponseSchema,
  type AuthActor,
  type LobbySnapshot,
  type RoomConfig,
  type RoomJoinMode,
  type RoomPublicSummary,
  type SessionEnvelope
} from "@potluck/contracts";

type PhaseTwoShellProps = {
  appName: string;
  appOrigin: string;
  serverOrigin: string;
  envName: string;
  statusLabel: string;
};

type AuthState = {
  session: SessionEnvelope;
  actor: AuthActor;
} | null;

type OtpRequestState = {
  challengeId: string;
  deliveryHint: string;
  expiresAt: string;
  cooldownSeconds: number;
} | null;

type ProcessTone = "idle" | "pending" | "success" | "error";
type ProcessFeedback = { tone: Exclude<ProcessTone, "idle">; message: string };

type ProcessButtonProps = {
  variant: "primary" | "secondary" | "ghost";
  tone: ProcessTone;
  idleLabel: string;
  pendingLabel: string;
  successLabel: string;
  errorLabel?: string;
  onClick: () => void;
  disabled?: boolean;
};

const initialRoomForm: RoomConfig = {
  tableName: "PotLuck Table",
  maxSeats: 6,
  variant: "HOLD_EM_NL",
  smallBlind: 50,
  bigBlind: 100,
  ante: 0,
  buyInMode: "BB_MULTIPLE",
  minBuyIn: 40,
  maxBuyIn: 250,
  rakeEnabled: false,
  rakePercent: 0,
  rakeCap: 0,
  oddChipRule: "LEFT_OF_BUTTON",
  spectatorsAllowed: true,
  straddleAllowed: false,
  rebuyEnabled: true,
  topUpEnabled: true,
  seatReservationTimeoutSeconds: 120,
  joinCodeExpiryMinutes: 120,
  waitingListEnabled: true,
  roomMaxDurationMinutes: 720
};

function createErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function getButtonLabel(props: Omit<ProcessButtonProps, "variant" | "onClick" | "disabled">) {
  if (props.tone === "pending") return props.pendingLabel;
  if (props.tone === "success") return props.successLabel;
  if (props.tone === "error") return props.errorLabel ?? props.idleLabel;
  return props.idleLabel;
}

function ProcessButton({
  variant,
  tone,
  idleLabel,
  pendingLabel,
  successLabel,
  errorLabel,
  onClick,
  disabled
}: ProcessButtonProps) {
  const toneClass = tone === "idle" ? "" : ` process-${tone}`;

  return (
    <button
      className={`${variant}-button process-button${toneClass}`}
      disabled={disabled || tone === "pending"}
      onClick={onClick}
      type="button"
    >
      <span className="process-indicator" aria-hidden="true" />
      {getButtonLabel({ tone, idleLabel, pendingLabel, successLabel, errorLabel })}
    </button>
  );
}

function ProcessNotice({ feedback }: { feedback: ProcessFeedback | null }) {
  if (!feedback) return null;
  return <p className={`process-notice process-${feedback.tone}`}>{feedback.message}</p>;
}

async function readResponse<T>(
  response: Response,
  parser: { parse: (value: unknown) => T }
): Promise<T> {
  const payload = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(payload);

    if (parsedError.success) {
      const issue = parsedError.data.error;
      throw new Error(issue.code ? `${issue.code}: ${issue.message}` : issue.message);
    }

    throw new Error("The server returned an unexpected error.");
  }

  return parser.parse(payload);
}

async function apiRequest<T>(
  serverOrigin: string,
  path: string,
  parser: { parse: (value: unknown) => T },
  init?: RequestInit
) {
  const response = await fetch(`${serverOrigin}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  return readResponse(response, parser);
}

function formatCountdown(expiresAt: string, nowMs: number) {
  const totalSeconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - nowMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PhaseTwoShell({
  appName,
  appOrigin,
  serverOrigin,
  envName,
  statusLabel
}: PhaseTwoShellProps) {
  const [authState, setAuthState] = useState<AuthState>(null);
  const [otpRequestState, setOtpRequestState] = useState<OtpRequestState>(null);
  const [roomPreview, setRoomPreview] = useState<RoomPublicSummary | null>(null);
  const [lobbySnapshot, setLobbySnapshot] = useState<LobbySnapshot | null>(null);
  const [adminEmail, setAdminEmail] = useState("host@example.com");
  const [adminCode, setAdminCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("RiverKid");
  const [joinMode, setJoinMode] = useState<RoomJoinMode>("PLAYER");
  const [roomForm, setRoomForm] = useState<RoomConfig>(initialRoomForm);
  const [isBooting, setIsBooting] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());
  const [requestOtpFeedback, setRequestOtpFeedback] = useState<ProcessFeedback | null>(null);
  const [verifyOtpFeedback, setVerifyOtpFeedback] = useState<ProcessFeedback | null>(null);
  const [createRoomFeedback, setCreateRoomFeedback] = useState<ProcessFeedback | null>(null);
  const [lookupFeedback, setLookupFeedback] = useState<ProcessFeedback | null>(null);
  const [joinRoomFeedback, setJoinRoomFeedback] = useState<ProcessFeedback | null>(null);
  const [lobbyFeedback, setLobbyFeedback] = useState<ProcessFeedback | null>(null);
  const [reserveFeedback, setReserveFeedback] = useState<ProcessFeedback | null>(null);
  const [queueFeedback, setQueueFeedback] = useState<ProcessFeedback | null>(null);
  const [refreshFeedback, setRefreshFeedback] = useState<ProcessFeedback | null>(null);
  const [logoutFeedback, setLogoutFeedback] = useState<ProcessFeedback | null>(null);

  async function refreshAuthState() {
    try {
      const response = await apiRequest(serverOrigin, "/api/auth/session", authStatusResponseSchema);

      if (!response.authenticated || !response.session || !response.actor) {
        setAuthState(null);
        return null;
      }

      const nextState = { session: response.session, actor: response.actor };
      setAuthState(nextState);
      return nextState;
    } catch {
      setAuthState(null);
      return null;
    }
  }

  async function loadLobby(roomId: string) {
    const snapshot = await apiRequest(
      serverOrigin,
      `/api/rooms/${roomId}/lobby`,
      lobbySnapshotSchema
    );
    setLobbySnapshot(snapshot);
    setRoomPreview(snapshot.room);
    return snapshot;
  }

  useEffect(() => {
    void (async () => {
      try {
        const session = await refreshAuthState();

        if (session?.actor.role === "GUEST") {
          await loadLobby(session.actor.roomId);
          setRoomCode(session.actor.roomCode);
        }
      } finally {
        setIsBooting(false);
      }
    })();
  }, [serverOrigin]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const statusCopy = useMemo(() => {
    if (isBooting) return "Checking for an existing admin or guest session.";
    if (!authState) return "No active session yet. Use OTP to create a room or join one by code.";
    if (authState.actor.role === "ADMIN") {
      return `Admin session active for ${authState.actor.email}.`;
    }
    return `Guest session active for ${authState.actor.nickname} in room ${authState.actor.roomCode}.`;
  }, [authState, isBooting]);

  const heroParticipant = useMemo(
    () =>
      lobbySnapshot?.heroParticipantId
        ? lobbySnapshot.participants.find(
            (participant) => participant.participantId === lobbySnapshot.heroParticipantId
          ) ?? null
        : null,
    [lobbySnapshot]
  );

  const derivedBuyInExample =
    roomForm.buyInMode === "BB_MULTIPLE"
      ? `${roomForm.minBuyIn}BB = ${(roomForm.minBuyIn * roomForm.bigBlind).toLocaleString()} chips`
      : `${roomForm.minBuyIn.toLocaleString()} chips`;

  function updateRoomForm<K extends keyof RoomConfig>(key: K, value: RoomConfig[K]) {
    setRoomForm((current) => ({ ...current, [key]: value }));
  }

  function resetTransientFeedback() {
    setLookupFeedback(null);
    setJoinRoomFeedback(null);
    setLobbyFeedback(null);
    setReserveFeedback(null);
    setQueueFeedback(null);
  }

  function handleRequestOtp() {
    setRequestOtpFeedback({ tone: "pending", message: "Sending your sign-in code now." });
    setVerifyOtpFeedback(null);

    void (async () => {
      try {
        const response = await apiRequest(
          serverOrigin,
          "/api/auth/admin/request-otp",
          adminOtpRequestResponseSchema,
          { method: "POST", body: JSON.stringify({ email: adminEmail }) }
        );

        setOtpRequestState({
          challengeId: response.challengeId,
          deliveryHint: response.delivery.recipientHint,
          expiresAt: response.expiresAt,
          cooldownSeconds: response.cooldownSeconds
        });
        setRequestOtpFeedback({
          tone: "success",
          message: `Code sent to ${response.delivery.recipientHint}.`
        });
      } catch (error) {
        setRequestOtpFeedback({ tone: "error", message: createErrorMessage(error) });
      }
    })();
  }

  function handleVerifyOtp() {
    if (!otpRequestState) {
      setVerifyOtpFeedback({
        tone: "error",
        message: "Request a code first so we have an active verification challenge."
      });
      return;
    }

    setVerifyOtpFeedback({ tone: "pending", message: "Verifying the OTP." });

    void (async () => {
      try {
        const response = await apiRequest(
          serverOrigin,
          "/api/auth/admin/verify-otp",
          authSessionResponseSchema,
          {
            method: "POST",
            body: JSON.stringify({
              challengeId: otpRequestState.challengeId,
              code: adminCode
            })
          }
        );

        setAuthState({ session: response.session, actor: response.actor });
        setAdminCode("");
        setVerifyOtpFeedback({ tone: "success", message: "Admin session is ready." });
      } catch (error) {
        setVerifyOtpFeedback({ tone: "error", message: createErrorMessage(error) });
      }
    })();
  }

  function handleCreateRoom() {
    setCreateRoomFeedback({
      tone: "pending",
      message: "Creating the room, minting a code, and opening the lobby."
    });
    resetTransientFeedback();

    void (async () => {
      try {
        const response = await apiRequest(
          serverOrigin,
          "/api/rooms",
          roomCreateResponseSchema,
          { method: "POST", body: JSON.stringify(roomForm) }
        );

        setRoomPreview(response.room);
        setRoomCode(response.room.code);
        setLobbySnapshot(response.lobbySnapshot);
        setCreateRoomFeedback({
          tone: "success",
          message: `Room ${response.room.code} is live and ready for joins.`
        });
      } catch (error) {
        setCreateRoomFeedback({ tone: "error", message: createErrorMessage(error) });
      }
    })();
  }

  function handleCheckRoom() {
    setLookupFeedback({ tone: "pending", message: "Checking the room code." });

    void (async () => {
      try {
        const summary = await apiRequest(
          serverOrigin,
          `/api/rooms/${encodeURIComponent(roomCode.trim().toUpperCase())}`,
          roomPublicSummarySchema
        );
        setRoomPreview(summary);
        setLookupFeedback({ tone: "success", message: `${summary.tableName} is ready to join.` });
      } catch (error) {
        setLookupFeedback({ tone: "error", message: createErrorMessage(error) });
      }
    })();
  }

  function handleJoinRoom() {
    setJoinRoomFeedback({ tone: "pending", message: "Joining the room and loading the lobby." });

    void (async () => {
      try {
        const response = await apiRequest(
          serverOrigin,
          `/api/rooms/${encodeURIComponent(roomCode.trim().toUpperCase())}/join`,
          joinRoomResponseSchema,
          {
            method: "POST",
            body: JSON.stringify({ nickname, mode: joinMode })
          }
        );

        setAuthState({ session: response.session, actor: response.actor });
        setRoomPreview(response.lobbySnapshot.room);
        setLobbySnapshot(response.lobbySnapshot);
        setJoinRoomFeedback({
          tone: "success",
          message: `Joined ${response.lobbySnapshot.room.tableName}.`
        });
      } catch (error) {
        setJoinRoomFeedback({ tone: "error", message: createErrorMessage(error) });
      }
    })();
  }

  function handleRefreshLobby() {
    const roomId =
      authState?.actor.role === "GUEST"
        ? authState.actor.roomId
        : lobbySnapshot?.room.roomId;

    if (!roomId) return;

    setLobbyFeedback({ tone: "pending", message: "Refreshing the latest lobby snapshot." });

    void (async () => {
      try {
        await loadLobby(roomId);
        await apiRequest(serverOrigin, `/api/rooms/${roomId}/buyin/quote`, buyInQuoteResponseSchema);
        setLobbyFeedback({ tone: "success", message: "Lobby snapshot refreshed." });
      } catch (error) {
        setLobbyFeedback({ tone: "error", message: createErrorMessage(error) });
      }
    })();
  }

  function handleReserveSeat(seatIndex: number) {
    const roomId =
      authState?.actor.role === "GUEST" ? authState.actor.roomId : lobbySnapshot?.room.roomId;

    if (!roomId) return;

    setReserveFeedback({
      tone: "pending",
      message: `Reserving seat ${seatIndex + 1} and starting the countdown.`
    });

    void (async () => {
      try {
        const response = await apiRequest(
          serverOrigin,
          `/api/rooms/${roomId}/seats/${seatIndex}`,
          seatReservationResponseSchema,
          { method: "POST", body: JSON.stringify({}) }
        );
        setLobbySnapshot(response.lobbySnapshot);
        setRoomPreview(response.lobbySnapshot.room);
        setReserveFeedback({
          tone: "success",
          message: `Seat ${response.reservedSeatIndex + 1} is reserved until ${new Date(
            response.reservedUntil
          ).toLocaleTimeString()}.`
        });
      } catch (error) {
        setReserveFeedback({ tone: "error", message: createErrorMessage(error) });
      }
    })();
  }

  function handleJoinQueue() {
    const roomId =
      authState?.actor.role === "GUEST" ? authState.actor.roomId : lobbySnapshot?.room.roomId;

    if (!roomId) return;

    setQueueFeedback({ tone: "pending", message: "Joining the waiting list." });

    void (async () => {
      try {
        const response = await apiRequest(
          serverOrigin,
          `/api/rooms/${roomId}/queue`,
          queueJoinResponseSchema,
          { method: "POST", body: JSON.stringify({}) }
        );
        setLobbySnapshot(response.lobbySnapshot);
        setQueueFeedback({
          tone: "success",
          message: `Waiting-list position ${response.queueEntry.position} confirmed.`
        });
      } catch (error) {
        setQueueFeedback({ tone: "error", message: createErrorMessage(error) });
      }
    })();
  }

  function handleRefreshSession() {
    setRefreshFeedback({ tone: "pending", message: "Refreshing the active session." });

    void (async () => {
      try {
        const response = await apiRequest(
          serverOrigin,
          "/api/auth/refresh",
          authSessionResponseSchema,
          { method: "POST", body: JSON.stringify({}) }
        );
        setAuthState({ session: response.session, actor: response.actor });
        setRefreshFeedback({ tone: "success", message: "Session refreshed successfully." });
      } catch (error) {
        setRefreshFeedback({ tone: "error", message: createErrorMessage(error) });
      }
    })();
  }

  function handleLogout() {
    setLogoutFeedback({ tone: "pending", message: "Signing out and clearing session cookies." });

    void (async () => {
      try {
        await apiRequest(serverOrigin, "/api/auth/logout", logoutResponseSchema, {
          method: "POST",
          body: JSON.stringify({})
        });
        setAuthState(null);
        setLobbySnapshot(null);
        setLogoutFeedback({ tone: "success", message: "Signed out successfully." });
      } catch (error) {
        setLogoutFeedback({ tone: "error", message: createErrorMessage(error) });
      }
    })();
  }

  return (
    <main className="phase-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Phase 02</p>
          <h1>{appName} room, lobby, and seating</h1>
          <p className="hero-text">
            Admin room creation, join-by-code, seat reservation timers, waiting lists, and
            buy-in quoting are now wired into one lobby flow.
          </p>
          <div className="hero-chips">
            <span>{statusLabel}</span>
            <span>{envName}</span>
            <span>{appOrigin}</span>
            {roomPreview ? <span>Room {roomPreview.code}</span> : null}
          </div>
        </div>
        <div className="status-card">
          <p className="status-label">Session status</p>
          <p className="status-text">{statusCopy}</p>
          <div className="status-actions">
            <ProcessButton
              variant="secondary"
              tone={refreshFeedback?.tone ?? "idle"}
              idleLabel="Refresh session"
              pendingLabel="Refreshing session"
              successLabel="Session refreshed"
              onClick={handleRefreshSession}
              disabled={!authState}
            />
            <ProcessButton
              variant="ghost"
              tone={logoutFeedback?.tone ?? "idle"}
              idleLabel="Sign out"
              pendingLabel="Signing out"
              successLabel="Signed out"
              onClick={handleLogout}
              disabled={!authState}
            />
          </div>
          <ProcessNotice feedback={refreshFeedback} />
          <ProcessNotice feedback={logoutFeedback} />
        </div>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-head">
            <p className="eyebrow">Step 1</p>
            <h2>Authenticate as admin</h2>
          </div>
          <label className="field">
            <span>Admin email</span>
            <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} />
          </label>
          <div className="action-row">
            <ProcessButton
              variant="primary"
              tone={requestOtpFeedback?.tone ?? "idle"}
              idleLabel="Send sign-in code"
              pendingLabel="Sending code"
              successLabel="Code sent"
              onClick={handleRequestOtp}
            />
          </div>
          <ProcessNotice feedback={requestOtpFeedback} />

          {otpRequestState ? (
            <div className="info-block">
              <div className="info-row"><span>Challenge</span><strong>{otpRequestState.challengeId}</strong></div>
              <div className="info-row"><span>Delivered to</span><strong>{otpRequestState.deliveryHint}</strong></div>
              <div className="info-row"><span>Expires at</span><strong>{new Date(otpRequestState.expiresAt).toLocaleString()}</strong></div>
            </div>
          ) : null}

          <label className="field">
            <span>One-time code</span>
            <input inputMode="numeric" maxLength={6} value={adminCode} onChange={(event) => setAdminCode(event.target.value)} />
          </label>
          <div className="action-row">
            <ProcessButton
              variant="secondary"
              tone={verifyOtpFeedback?.tone ?? "idle"}
              idleLabel="Verify code"
              pendingLabel="Verifying OTP"
              successLabel="OTP verified"
              onClick={handleVerifyOtp}
            />
          </div>
          <ProcessNotice feedback={verifyOtpFeedback} />
        </article>

        <article className="panel">
          <div className="panel-head">
            <p className="eyebrow">Step 2</p>
            <h2>Create a room</h2>
          </div>
          <div className="field-grid">
            <label className="field"><span>Table name</span><input value={roomForm.tableName} onChange={(event) => updateRoomForm("tableName", event.target.value)} /></label>
            <label className="field"><span>Seats</span><input type="number" min={2} max={9} value={roomForm.maxSeats} onChange={(event) => updateRoomForm("maxSeats", Number(event.target.value))} /></label>
            <label className="field"><span>Small blind</span><input type="number" min={1} value={roomForm.smallBlind} onChange={(event) => updateRoomForm("smallBlind", Number(event.target.value))} /></label>
            <label className="field"><span>Big blind</span><input type="number" min={1} value={roomForm.bigBlind} onChange={(event) => updateRoomForm("bigBlind", Number(event.target.value))} /></label>
            <label className="field"><span>Ante</span><input type="number" min={0} value={roomForm.ante} onChange={(event) => updateRoomForm("ante", Number(event.target.value))} /></label>
            <label className="field"><span>Buy-in mode</span><input value={roomForm.buyInMode} onChange={(event) => updateRoomForm("buyInMode", event.target.value as RoomConfig["buyInMode"])} /></label>
            <label className="field"><span>Min buy-in</span><input type="number" min={1} value={roomForm.minBuyIn} onChange={(event) => updateRoomForm("minBuyIn", Number(event.target.value))} /></label>
            <label className="field"><span>Max buy-in</span><input type="number" min={1} value={roomForm.maxBuyIn} onChange={(event) => updateRoomForm("maxBuyIn", Number(event.target.value))} /></label>
          </div>
          <div className="toggle-row">
            <button className={roomForm.spectatorsAllowed ? "mode-chip active" : "mode-chip"} onClick={() => updateRoomForm("spectatorsAllowed", !roomForm.spectatorsAllowed)} type="button">Spectators {roomForm.spectatorsAllowed ? "On" : "Off"}</button>
            <button className={roomForm.waitingListEnabled ? "mode-chip active" : "mode-chip"} onClick={() => updateRoomForm("waitingListEnabled", !roomForm.waitingListEnabled)} type="button">Waiting list {roomForm.waitingListEnabled ? "On" : "Off"}</button>
            <button className={roomForm.straddleAllowed ? "mode-chip active" : "mode-chip"} onClick={() => updateRoomForm("straddleAllowed", !roomForm.straddleAllowed)} type="button">Straddle {roomForm.straddleAllowed ? "On" : "Off"}</button>
            <button className={roomForm.rebuyEnabled ? "mode-chip active" : "mode-chip"} onClick={() => updateRoomForm("rebuyEnabled", !roomForm.rebuyEnabled)} type="button">Rebuy {roomForm.rebuyEnabled ? "On" : "Off"}</button>
            <button className={roomForm.topUpEnabled ? "mode-chip active" : "mode-chip"} onClick={() => updateRoomForm("topUpEnabled", !roomForm.topUpEnabled)} type="button">Top-up {roomForm.topUpEnabled ? "On" : "Off"}</button>
          </div>
          <div className="info-block">
            <div className="info-row"><span>Derived min example</span><strong>{derivedBuyInExample}</strong></div>
            <div className="info-row"><span>Seat reservation</span><strong>{roomForm.seatReservationTimeoutSeconds}s</strong></div>
            <div className="info-row"><span>Join code expiry</span><strong>{roomForm.joinCodeExpiryMinutes} min</strong></div>
          </div>
          <div className="action-row">
            <ProcessButton
              variant="primary"
              tone={createRoomFeedback?.tone ?? "idle"}
              idleLabel="Create room"
              pendingLabel="Creating room"
              successLabel="Room created"
              onClick={handleCreateRoom}
              disabled={authState?.actor.role !== "ADMIN"}
            />
          </div>
          <ProcessNotice feedback={createRoomFeedback} />
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-head">
            <p className="eyebrow">Guest Entry</p>
            <h2>Join by room code</h2>
          </div>
          <div className="field-grid">
            <label className="field"><span>Room code</span><input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} /></label>
            <label className="field"><span>Nickname</span><input value={nickname} onChange={(event) => setNickname(event.target.value)} /></label>
          </div>
          <div className="mode-picker" role="radiogroup" aria-label="Join mode">
            <button className={joinMode === "PLAYER" ? "mode-chip active" : "mode-chip"} onClick={() => setJoinMode("PLAYER")} type="button">Player</button>
            <button className={joinMode === "SPECTATOR" ? "mode-chip active" : "mode-chip"} onClick={() => setJoinMode("SPECTATOR")} type="button">Spectator</button>
          </div>
          <div className="action-row">
            <ProcessButton variant="secondary" tone={lookupFeedback?.tone ?? "idle"} idleLabel="Check room" pendingLabel="Checking room" successLabel="Room checked" onClick={handleCheckRoom} />
            <ProcessButton variant="primary" tone={joinRoomFeedback?.tone ?? "idle"} idleLabel="Join lobby" pendingLabel="Joining lobby" successLabel="Lobby joined" onClick={handleJoinRoom} />
          </div>
          <ProcessNotice feedback={lookupFeedback} />
          <ProcessNotice feedback={joinRoomFeedback} />
          {roomPreview ? (
            <div className="stat-grid">
              <div className="stat-card"><span>Open seats</span><strong>{roomPreview.openSeatCount}</strong></div>
              <div className="stat-card"><span>Reserved</span><strong>{roomPreview.reservedSeatCount}</strong></div>
              <div className="stat-card"><span>Queue</span><strong>{roomPreview.queuedCount}</strong></div>
              <div className="stat-card"><span>Status</span><strong>{roomPreview.status}</strong></div>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-head">
            <p className="eyebrow">Lobby</p>
            <h2>Seats, queue, and buy-in quote</h2>
          </div>
          <div className="action-row">
            <ProcessButton variant="secondary" tone={lobbyFeedback?.tone ?? "idle"} idleLabel="Refresh lobby" pendingLabel="Refreshing lobby" successLabel="Lobby refreshed" onClick={handleRefreshLobby} disabled={!lobbySnapshot} />
          </div>
          <ProcessNotice feedback={lobbyFeedback} />
          <ProcessNotice feedback={reserveFeedback} />
          <ProcessNotice feedback={queueFeedback} />

          {lobbySnapshot ? (
            <>
              <div className="info-block">
                <div className="info-row"><span>Room code</span><strong>{lobbySnapshot.room.code}</strong></div>
                <div className="info-row"><span>Table</span><strong>{lobbySnapshot.room.tableName}</strong></div>
                <div className="info-row"><span>Buy-in range</span><strong>{lobbySnapshot.buyInQuote.displayMin} to {lobbySnapshot.buyInQuote.displayMax}</strong></div>
                <div className="info-row"><span>Hero state</span><strong>{heroParticipant?.state ?? "Observer"}</strong></div>
              </div>

              <div className="seat-grid">
                {lobbySnapshot.seats.map((seat) => {
                  const canReserve =
                    seat.status === "EMPTY" &&
                    authState?.actor.role === "GUEST" &&
                    authState.actor.mode === "PLAYER" &&
                    !lobbySnapshot.heroSeatIndex;

                  return (
                    <button key={seat.seatIndex} className={`seat-card seat-${seat.status.toLowerCase()}`} type="button" onClick={() => (canReserve ? handleReserveSeat(seat.seatIndex) : undefined)} disabled={!canReserve}>
                      <span>Seat {seat.seatIndex + 1}</span>
                      <strong>{seat.nickname ?? seat.status}</strong>
                      {seat.reservedUntil ? <small>Countdown {formatCountdown(seat.reservedUntil, nowMs)}</small> : <small>{seat.status === "EMPTY" ? "Tap to reserve" : "Unavailable"}</small>}
                    </button>
                  );
                })}
              </div>

              {lobbySnapshot.canJoinWaitingList ? (
                <div className="action-row">
                  <ProcessButton variant="primary" tone={queueFeedback?.tone ?? "idle"} idleLabel="Join waiting list" pendingLabel="Joining queue" successLabel="Queue joined" onClick={handleJoinQueue} />
                </div>
              ) : null}

              <div className="subpanel-grid">
                <div className="info-block">
                  <div className="panel-head compact"><p className="eyebrow">Participants</p><h3>{lobbySnapshot.participants.length} active</h3></div>
                  <ul className="participant-list">
                    {lobbySnapshot.participants.map((participant) => (
                      <li key={participant.participantId}>
                        <span>{participant.nickname}</span>
                        <small>{participant.state}{participant.queuePosition ? ` - Q${participant.queuePosition}` : ""}{participant.seatIndex !== undefined ? ` - Seat ${participant.seatIndex + 1}` : ""}</small>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="info-block">
                  <div className="panel-head compact"><p className="eyebrow">Waiting List</p><h3>{lobbySnapshot.waitingList.length} queued</h3></div>
                  {lobbySnapshot.waitingList.length ? (
                    <ul className="participant-list">
                      {lobbySnapshot.waitingList.map((entry) => (
                        <li key={entry.entryId}><span>{entry.nickname}</span><small>Position {entry.position}</small></li>
                      ))}
                    </ul>
                  ) : (
                    <p className="panel-copy">No one is queued yet. The table needs at least two ready players to start a hand later.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="gate-card muted">
              <p className="eyebrow">Ready When You Are</p>
              <h3>No lobby loaded yet</h3>
              <p>Create a room as admin or join one by code to load the Phase 2 lobby snapshot.</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  adminOtpRequestResponseSchema,
  apiErrorSchema,
  authSessionResponseSchema,
  authStatusResponseSchema,
  joinRoomResponseSchema,
  logoutResponseSchema,
  roomPublicSummarySchema,
  type AuthActor,
  type LobbySnapshot,
  type RoomJoinMode,
  type RoomPublicSummary,
  type SessionEnvelope
} from "@potluck/contracts";

type PhaseOneShellProps = {
  appName: string;
  appOrigin: string;
  serverOrigin: string;
  envName: string;
  statusLabel: string;
};

type ApiProblem = {
  code?: string;
  message: string;
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

const demoCodes = [
  {
    code: "DEMO42",
    label: "Open demo room",
    note: "Use this for a full happy-path join as player or spectator."
  },
  {
    code: "FINALE",
    label: "Closed room",
    note: "Use this to confirm typed closed-room handling."
  },
  {
    code: "SUNSET",
    label: "Expired code",
    note: "Use this to confirm expired room-code errors."
  }
] as const;

function createApiProblem(error: unknown): ApiProblem {
  if (error instanceof Error) {
    return {
      message: error.message
    };
  }

  return {
    message: "Something went wrong. Please try again."
  };
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

export function PhaseOneShell({
  appName,
  appOrigin,
  serverOrigin,
  envName,
  statusLabel
}: PhaseOneShellProps) {
  const [authState, setAuthState] = useState<AuthState>(null);
  const [authProblem, setAuthProblem] = useState<ApiProblem | null>(null);
  const [joinProblem, setJoinProblem] = useState<ApiProblem | null>(null);
  const [roomPreview, setRoomPreview] = useState<RoomPublicSummary | null>(null);
  const [lobbySnapshot, setLobbySnapshot] = useState<LobbySnapshot | null>(null);
  const [otpRequestState, setOtpRequestState] = useState<OtpRequestState>(null);
  const [adminEmail, setAdminEmail] = useState("host@example.com");
  const [adminCode, setAdminCode] = useState("");
  const [roomCode, setRoomCode] = useState("DEMO42");
  const [nickname, setNickname] = useState("RiverKid");
  const [joinMode, setJoinMode] = useState<RoomJoinMode>("PLAYER");
  const [isBooting, setIsBooting] = useState(true);
  const [isAuthPending, startAuthTransition] = useTransition();
  const [isJoinPending, startJoinTransition] = useTransition();

  async function refreshAuthState() {
    setAuthProblem(null);

    try {
      const response = await apiRequest(
        serverOrigin,
        "/api/auth/session",
        authStatusResponseSchema
      );

      if (!response.authenticated || !response.session || !response.actor) {
        setAuthState(null);
        return;
      }

      setAuthState({
        session: response.session,
        actor: response.actor
      });
    } catch (error) {
      setAuthProblem(createApiProblem(error));
      setAuthState(null);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await refreshAuthState();
      } finally {
        setIsBooting(false);
      }
    })();
  }, [serverOrigin]);

  const statusCopy = useMemo(() => {
    if (isBooting) {
      return "Checking for an existing admin or guest session.";
    }

    if (!authState) {
      return "No active session yet. Start with OTP for admin access or join a room as a guest.";
    }

    if (authState.actor.role === "ADMIN") {
      return `Admin session active for ${authState.actor.email}.`;
    }

    return `Guest session active for ${authState.actor.nickname} in room ${authState.actor.roomCode}.`;
  }, [authState, isBooting]);

  const showCreateRoomGate = authState?.actor.role === "ADMIN";

  function handleRequestOtp() {
    startAuthTransition(() => {
      void (async () => {
        setAuthProblem(null);

        try {
          const response = await apiRequest(
            serverOrigin,
            "/api/auth/admin/request-otp",
            adminOtpRequestResponseSchema,
            {
              method: "POST",
              body: JSON.stringify({
                email: adminEmail
              })
            }
          );

          setOtpRequestState({
            challengeId: response.challengeId,
            deliveryHint: response.delivery.recipientHint,
            expiresAt: response.expiresAt,
            cooldownSeconds: response.cooldownSeconds
          });
        } catch (error) {
          setAuthProblem(createApiProblem(error));
        }
      })();
    });
  }

  function handleVerifyOtp() {
    startAuthTransition(() => {
      void (async () => {
        if (!otpRequestState) {
          setAuthProblem({
            message: "Request a code first so we have an active verification challenge."
          });
          return;
        }

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

          setAuthState({
            session: response.session,
            actor: response.actor
          });
          setAdminCode("");
          setAuthProblem(null);
        } catch (error) {
          setAuthProblem(createApiProblem(error));
        }
      })();
    });
  }

  function handleJoinRoom(checkOnly: boolean) {
    startJoinTransition(() => {
      void (async () => {
        setJoinProblem(null);

        try {
          const summary = await apiRequest(
            serverOrigin,
            `/api/rooms/${encodeURIComponent(roomCode.trim().toUpperCase())}`,
            roomPublicSummarySchema
          );

          setRoomPreview(summary);

          if (checkOnly) {
            return;
          }

          const response = await apiRequest(
            serverOrigin,
            `/api/rooms/${encodeURIComponent(roomCode.trim().toUpperCase())}/join`,
            joinRoomResponseSchema,
            {
              method: "POST",
              body: JSON.stringify({
                nickname,
                mode: joinMode
              })
            }
          );

          setAuthState({
            session: response.session,
            actor: response.actor
          });
          setLobbySnapshot(response.lobbySnapshot);
        } catch (error) {
          setJoinProblem(createApiProblem(error));
          if (!checkOnly) {
            setLobbySnapshot(null);
          }
        }
      })();
    });
  }

  function handleRefreshSession() {
    startAuthTransition(() => {
      void (async () => {
        try {
          const response = await apiRequest(
            serverOrigin,
            "/api/auth/refresh",
            authSessionResponseSchema,
            {
              method: "POST",
              body: JSON.stringify({})
            }
          );

          setAuthState({
            session: response.session,
            actor: response.actor
          });
          setAuthProblem(null);
        } catch (error) {
          setAuthProblem(createApiProblem(error));
        }
      })();
    });
  }

  function handleLogout() {
    startAuthTransition(() => {
      void (async () => {
        try {
          await apiRequest(serverOrigin, "/api/auth/logout", logoutResponseSchema, {
            method: "POST",
            body: JSON.stringify({})
          });

          setAuthState(null);
          setLobbySnapshot(null);
          setAuthProblem(null);
        } catch (error) {
          setAuthProblem(createApiProblem(error));
        }
      })();
    });
  }

  return (
    <main className="phase-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Phase 01</p>
          <h1>{appName} auth, admin access, and guest entry</h1>
          <p className="hero-text">
            Secure OTP sessions are live, guest join-by-code is wired, and the
            local build now exposes a polished front door for the later room and
            gameplay phases.
          </p>
          <div className="hero-chips">
            <span>{statusLabel}</span>
            <span>{envName}</span>
            <span>{appOrigin}</span>
          </div>
        </div>
        <div className="status-card">
          <p className="status-label">Session status</p>
          <p className="status-text">{statusCopy}</p>
          {authState ? (
            <div className="status-actions">
              <button
                className="secondary-button"
                onClick={handleRefreshSession}
                type="button"
              >
                Refresh session
              </button>
              <button
                className="ghost-button"
                onClick={handleLogout}
                type="button"
              >
                Sign out
              </button>
            </div>
          ) : null}
          {authProblem ? (
            <p className="notice error-notice">{authProblem.message}</p>
          ) : null}
        </div>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-head">
            <p className="eyebrow">Guest Entry</p>
            <h2>Join a room by code</h2>
          </div>
          <p className="panel-copy">
            This covers the phase’s player-facing entry path: room lookup,
            nickname conflict checks, spectator mode, and signed guest sessions.
          </p>

          <div className="demo-code-grid">
            {demoCodes.map((demoCode) => (
              <button
                key={demoCode.code}
                className="demo-code"
                onClick={() => setRoomCode(demoCode.code)}
                type="button"
              >
                <strong>{demoCode.code}</strong>
                <span>{demoCode.label}</span>
                <small>{demoCode.note}</small>
              </button>
            ))}
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Room code</span>
              <input
                autoCapitalize="characters"
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                value={roomCode}
              />
            </label>
            <label className="field">
              <span>Nickname</span>
              <input
                onChange={(event) => setNickname(event.target.value)}
                value={nickname}
              />
            </label>
          </div>

          <div className="mode-picker" role="radiogroup" aria-label="Join mode">
            <button
              className={joinMode === "PLAYER" ? "mode-chip active" : "mode-chip"}
              onClick={() => setJoinMode("PLAYER")}
              type="button"
            >
              Player
            </button>
            <button
              className={joinMode === "SPECTATOR" ? "mode-chip active" : "mode-chip"}
              onClick={() => setJoinMode("SPECTATOR")}
              type="button"
            >
              Spectator
            </button>
          </div>

          <div className="action-row">
            <button
              className="secondary-button"
              disabled={isJoinPending}
              onClick={() => handleJoinRoom(true)}
              type="button"
            >
              Check room
            </button>
            <button
              className="primary-button"
              disabled={isJoinPending}
              onClick={() => handleJoinRoom(false)}
              type="button"
            >
              {isJoinPending ? "Working..." : "Join by code"}
            </button>
          </div>

          {joinProblem ? (
            <p className="notice error-notice">{joinProblem.message}</p>
          ) : null}

          {roomPreview ? (
            <div className="info-block">
              <div className="info-row">
                <span>Status</span>
                <strong>{roomPreview.status}</strong>
              </div>
              <div className="info-row">
                <span>Table</span>
                <strong>{roomPreview.tableName}</strong>
              </div>
              <div className="info-row">
                <span>Open seats</span>
                <strong>
                  {roomPreview.openSeatCount} / {roomPreview.maxSeats}
                </strong>
              </div>
              <div className="info-row">
                <span>Spectators</span>
                <strong>{roomPreview.spectatorsAllowed ? "Allowed" : "Off"}</strong>
              </div>
            </div>
          ) : null}

          {lobbySnapshot ? (
            <div className="lobby-block">
              <div className="panel-head compact">
                <p className="eyebrow">Lobby Snapshot</p>
                <h3>{lobbySnapshot.room.tableName}</h3>
              </div>
              <ul className="participant-list">
                {lobbySnapshot.participants.map((participant) => (
                  <li key={participant.participantId}>
                    <span>{participant.nickname}</span>
                    <small>
                      {participant.mode} · {participant.state}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-head">
            <p className="eyebrow">Admin Gate</p>
            <h2>Verify admin access by email OTP</h2>
          </div>
          <p className="panel-copy">
            This gate is intentionally focused on secure entry. Actual room
            creation stays in Phase 02, but the authenticated admin experience
            is ready now.
          </p>

          <label className="field">
            <span>Admin email</span>
            <input
              onChange={(event) => setAdminEmail(event.target.value)}
              type="email"
              value={adminEmail}
            />
          </label>

          <div className="action-row">
            <button
              className="primary-button"
              disabled={isAuthPending}
              onClick={handleRequestOtp}
              type="button"
            >
              {isAuthPending ? "Sending..." : "Send sign-in code"}
            </button>
          </div>

          {otpRequestState ? (
            <div className="info-block">
              <div className="info-row">
                <span>Challenge</span>
                <strong>{otpRequestState.challengeId}</strong>
              </div>
              <div className="info-row">
                <span>Delivered to</span>
                <strong>{otpRequestState.deliveryHint}</strong>
              </div>
              <div className="info-row">
                <span>Expires at</span>
                <strong>{new Date(otpRequestState.expiresAt).toLocaleString()}</strong>
              </div>
              <div className="info-row">
                <span>Cooldown</span>
                <strong>{otpRequestState.cooldownSeconds}s</strong>
              </div>
            </div>
          ) : null}

          <label className="field">
            <span>One-time code</span>
            <input
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setAdminCode(event.target.value)}
              placeholder="123456"
              value={adminCode}
            />
          </label>

          <div className="action-row">
            <button
              className="secondary-button"
              disabled={isAuthPending}
              onClick={handleVerifyOtp}
              type="button"
            >
              Verify code
            </button>
          </div>

          {showCreateRoomGate ? (
            <div className="gate-card">
              <p className="eyebrow">Gate Complete</p>
              <h3>Create-room unlock is ready</h3>
              <p>
                Your admin session is active, cookies are signed, and the app can
                safely enforce admin-only room creation in Phase 02.
              </p>
              <div className="info-row">
                <span>Admin</span>
                <strong>{authState?.actor.role === "ADMIN" ? authState.actor.email : ""}</strong>
              </div>
              <div className="info-row">
                <span>Session expires</span>
                <strong>
                  {authState ? new Date(authState.session.expiresAt).toLocaleString() : ""}
                </strong>
              </div>
            </div>
          ) : (
            <div className="gate-card muted">
              <p className="eyebrow">Next Phase</p>
              <h3>Room creation begins in Phase 02</h3>
              <p>
                This phase stops at the secure gate on purpose. Once you verify
                OTP, the room wizard can sit behind a real admin session instead
                of an untrusted client-side toggle.
              </p>
            </div>
          )}
        </article>
      </section>

      <section className="footer-strip">
        <div>
          <p className="eyebrow">Server Origin</p>
          <strong>{serverOrigin}</strong>
        </div>
        <div>
          <p className="eyebrow">Suggested manual path</p>
          <strong>1. Send OTP 2. Verify 3. Join `DEMO42`</strong>
        </div>
      </section>
    </main>
  );
}

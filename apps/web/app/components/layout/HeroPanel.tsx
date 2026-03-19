import { ProcessButton } from "../common/ProcessButton";
import { ProcessNotice } from "../common/ProcessNotice";

import type { ProcessFeedback } from "../../lib/phase-two-types";

type HeroPanelProps = {
  appName: string;
  appOrigin: string;
  envName: string;
  roomCode?: string;
  statusCopy: string;
  statusLabel: string;
  refreshFeedback: ProcessFeedback | null;
  logoutFeedback: ProcessFeedback | null;
  onRefreshSession: () => void;
  onLogout: () => void;
  hasAuthState: boolean;
};

export function HeroPanel({
  appName,
  appOrigin,
  envName,
  roomCode,
  statusCopy,
  statusLabel,
  refreshFeedback,
  logoutFeedback,
  onRefreshSession,
  onLogout,
  hasAuthState
}: HeroPanelProps) {
  return (
    <section className="hero-panel">
      <div className="hero-copy">
        <p className="eyebrow">PotLuck live room</p>
        <h1>{appName} keeps entry, seating, and live play in one calm table flow.</h1>
        <p className="hero-text">
          Step into a room, claim a seat, and manage the hand without bouncing across separate
          debug panels. The interface now tightens around the actual player journey.
        </p>
        <div className="hero-chips">
          <span>{statusLabel}</span>
          <span>{envName}</span>
          <span>{appOrigin}</span>
          {roomCode ? <span>Room {roomCode}</span> : null}
        </div>
      </div>

      <div className="status-card">
        <p className="status-label">Session status</p>
        <p className="status-text">{statusCopy}</p>
        <div className="status-actions">
          <ProcessButton
            disabled={!hasAuthState}
            errorLabel="Retry refresh"
            idleLabel="Refresh session"
            onClick={onRefreshSession}
            pendingLabel="Refreshing session"
            successLabel="Session refreshed"
            tone={refreshFeedback?.tone ?? "idle"}
            variant="secondary"
          />
          <ProcessButton
            disabled={!hasAuthState}
            errorLabel="Try sign out again"
            idleLabel="Sign out"
            onClick={onLogout}
            pendingLabel="Signing out"
            successLabel="Signed out"
            tone={logoutFeedback?.tone ?? "idle"}
            variant="ghost"
          />
        </div>
        <ProcessNotice feedback={refreshFeedback} />
        <ProcessNotice feedback={logoutFeedback} />
      </div>
    </section>
  );
}

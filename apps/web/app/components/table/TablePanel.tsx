import { formatChips, formatCountdown, type ActionTrayState, type TableSeatViewModel } from "../../table-state";

import { CardFace } from "../common/CardFace";
import { EmptyState } from "../common/EmptyState";
import { ProcessNotice } from "../common/ProcessNotice";

import type { AuthState, ProcessFeedback, SocketStatus } from "../../lib/phase-two-types";
import type { RoomPrivateState, RoomRealtimeSnapshot } from "@potluck/contracts";

type TablePanelProps = {
  actionAffordances: RoomPrivateState["actionAffordances"] | null;
  actionTray: ActionTrayState;
  activeCallAmount: number;
  authState: AuthState;
  betAmount: string;
  boardCards: string[];
  currentSeatSnapshot: RoomRealtimeSnapshot["seats"][number] | null;
  heroSeatIndex: number | undefined;
  isSpectatorSession: boolean;
  latestModerationMessage?: string;
  liveSnapshot: RoomRealtimeSnapshot | null;
  lockedNotice: string | null;
  nowMs: number;
  potBadges: Array<{ amount: number; key: string; label: string }>;
  privateState: RoomPrivateState | null;
  reconnectCopy: string | null;
  roomCode?: string;
  sizingAmount: number;
  socketFeedback: ProcessFeedback | null;
  socketStatus: SocketStatus;
  tableSeatModels: TableSeatViewModel[];
  onActionIntent: (actionType: "CHECK" | "FOLD" | "CALL" | "BET" | "RAISE" | "ALL_IN") => void;
  onActionPreset: (amount: number) => void;
  onBetAmountChange: (value: string) => void;
  onReadyForHand: () => void;
  onSitOutNextHand: () => void;
  onSitOutNow: () => void;
};

function getInitials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TablePanel({
  actionAffordances,
  actionTray,
  activeCallAmount,
  authState,
  betAmount,
  boardCards,
  currentSeatSnapshot,
  heroSeatIndex,
  isSpectatorSession,
  latestModerationMessage,
  liveSnapshot,
  lockedNotice,
  nowMs,
  potBadges,
  privateState,
  reconnectCopy,
  roomCode,
  sizingAmount,
  socketFeedback,
  socketStatus,
  tableSeatModels,
  onActionIntent,
  onActionPreset,
  onBetAmountChange,
  onReadyForHand,
  onSitOutNextHand,
  onSitOutNow
}: TablePanelProps) {
  const activeHand = liveSnapshot?.activeHand ?? null;
  const canControlSeat =
    authState?.actor.role === "GUEST" && privateState?.seatIndex !== undefined;

  return (
    <article className="panel table-panel" id="table-stage">
      <div className="panel-head">
        <p className="eyebrow">Live table</p>
        <h2>Seat ring, board state, and action tray</h2>
        <p className="panel-copy">
          Public table state stays visible to everyone, while hero-only controls and cards only
          appear when the session is entitled to them.
        </p>
      </div>

      <div className="table-pill-row">
        <span className="table-pill">Socket {socketStatus}</span>
        <span className="table-pill">Room {liveSnapshot?.room.code ?? roomCode ?? "Not connected"}</span>
        <span className="table-pill">Event {liveSnapshot?.roomEventNo ?? 0}</span>
        <span className="table-pill">Phase {liveSnapshot?.tablePhase ?? "BETWEEN_HANDS"}</span>
      </div>
      <ProcessNotice feedback={socketFeedback} />

      {liveSnapshot?.pausedReason ? (
        <div className="incident-banner critical">
          <strong>Room paused</strong>
          <span>{liveSnapshot.pausedReason}</span>
        </div>
      ) : null}
      {lockedNotice ? (
        <div className="incident-banner warning">
          <strong>Join lock</strong>
          <span>{lockedNotice}</span>
        </div>
      ) : null}
      {latestModerationMessage ? (
        <div className="incident-banner">
          <strong>Latest moderation</strong>
          <span>{latestModerationMessage}</span>
        </div>
      ) : null}
      {isSpectatorSession ? (
        <div className="incident-banner info">
          <strong>Spectator feed</strong>
          <span>Private cards and action affordances stay hidden until the hand becomes public.</span>
        </div>
      ) : null}

      {liveSnapshot ? (
        <>
          {reconnectCopy ? (
            <div className="reconnect-banner">
              <strong>Reconnect state</strong>
              <span>{reconnectCopy}</span>
            </div>
          ) : null}

          <div className="felt-stage">
            <div className="table-headline-row">
              <div>
                <p className="eyebrow">{activeHand ? activeHand.street : "Between hands"}</p>
                <h3 className="table-title">
                  {activeHand
                    ? `Hand ${activeHand.handNumber} | ${activeHand.handId}`
                    : "Waiting for enough ready players"}
                </h3>
              </div>
              <div className="table-pill-row compact">
                <span className="table-pill">
                  Hero {heroSeatIndex !== undefined ? `Seat ${heroSeatIndex + 1}` : "Observer"}
                </span>
                <span className="table-pill">
                  Stack {formatChips(privateState?.stack ?? currentSeatSnapshot?.stack, { compact: true })}
                </span>
                <span className="table-pill">
                  {activeHand?.actingSeatIndex !== undefined
                    ? `Acting seat ${activeHand.actingSeatIndex + 1}`
                    : "No active turn"}
                </span>
              </div>
            </div>

            <div className="seat-ring">
              <div className="board-oval">
                <div className="pot-badge-row">
                  {potBadges.length ? (
                    potBadges.map((pot) => (
                      <div className="pot-badge" key={pot.key}>
                        <span>{pot.label}</span>
                        <strong>{formatChips(pot.amount, { compact: true })}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="pot-badge muted">
                      <span>Pot</span>
                      <strong>{activeHand ? formatChips(activeHand.potTotal) : "No pot yet"}</strong>
                    </div>
                  )}
                </div>

                <div className="board-rail">
                  {Array.from({ length: 5 }, (_, index) => (
                    <CardFace card={boardCards[index]} key={`board-${index}`} />
                  ))}
                </div>

                <div className="board-meta-grid">
                  <div className="board-meta-card">
                    <span>Current bet</span>
                    <strong>{formatChips(activeHand?.currentBet ?? 0, { compact: true })}</strong>
                  </div>
                  <div className="board-meta-card">
                    <span>Min raise</span>
                    <strong>{formatChips(activeHand?.minimumRaiseTo ?? 0, { compact: true })}</strong>
                  </div>
                  <div className="board-meta-card">
                    <span>Action clock</span>
                    <strong>
                      {activeHand ? formatCountdown(activeHand.deadlineAt, nowMs) : "Stand by"}
                    </strong>
                  </div>
                </div>
              </div>

              {tableSeatModels.map((seat) => (
                <article
                  className={`table-seat ${seat.positionClass} tone-${seat.statusTone}${seat.isActing ? " is-acting" : ""}${seat.isFolded ? " is-folded" : ""}`}
                  key={seat.seatIndex}
                >
                  <div className="table-seat-head">
                    <div className="seat-identity">
                      <span className="seat-avatar" aria-hidden="true">
                        {getInitials(seat.occupant)}
                      </span>
                      <div>
                        <span>{seat.title}</span>
                        <h4>{seat.occupant}</h4>
                      </div>
                    </div>
                    {seat.badgeLabel ? <strong className="seat-badge">{seat.badgeLabel}</strong> : null}
                  </div>
                  <p>{seat.stackLabel}</p>
                  <small>{seat.detailLabel}</small>
                  {seat.timerLabel ? <span className="seat-timer">{seat.timerLabel}</span> : null}
                  <div className="seat-card-preview">
                    {seat.hasPrivateCards ? (
                      <>
                        <CardFace card={privateState?.holeCards?.[0]} />
                        <CardFace card={privateState?.holeCards?.[1]} />
                      </>
                    ) : seat.showCardBacks ? (
                      <>
                        <CardFace hidden />
                        <CardFace hidden />
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="hero-pocket">
            <div>
              <p className="eyebrow">Private cards</p>
              <h3>
                {isSpectatorSession
                  ? "Spectator feed"
                  : privateState?.holeCards?.length
                    ? "Pocket cards live"
                    : "Public-only state"}
              </h3>
            </div>
            <div className="hero-pocket-cards">
              {privateState?.holeCards?.length ? (
                privateState.holeCards.map((card) => <CardFace card={card} key={card} />)
              ) : (
                <>
                  <CardFace hidden />
                  <CardFace hidden />
                </>
              )}
            </div>
            <p className="panel-copy">
              {isSpectatorSession
                ? "You are subscribed to the public table state only, so no hero-only data appears here."
                : privateState?.holeCards?.length
                  ? "These stay anchored near the player edge while public seats only show card backs."
                  : "Hosts and spectators keep the same table layout without private information."}
            </p>
          </div>

          <div className="action-tray">
            <div className="action-tray-head">
              <div>
                <p className="eyebrow">Action tray</p>
                <h3>
                  {actionTray.quickActions.length || actionTray.sizingAction
                    ? "Only legal actions are shown"
                    : "Between-hand controls"}
                </h3>
              </div>
              <div className="table-pill-row compact">
                {activeCallAmount > 0 ? (
                  <span className="table-pill">Call {formatChips(activeCallAmount, { compact: true })}</span>
                ) : null}
                {actionAffordances?.allInAmount ? (
                  <span className="table-pill">
                    All-in {formatChips(actionAffordances.allInAmount, { compact: true })}
                  </span>
                ) : null}
              </div>
            </div>

            {actionTray.quickActions.length || actionTray.sizingAction ? (
              <>
                <div className="tray-button-row">
                  {actionTray.quickActions.map((action) => (
                    <button
                      className={`${action.tone}-button tray-action-button`}
                      key={action.actionType}
                      onClick={() => onActionIntent(action.actionType)}
                      type="button"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                {actionTray.sizingAction ? (
                  <div className="sizing-panel">
                    <div className="sizing-panel-head">
                      <div>
                        <span>{actionTray.sizingAction.label}</span>
                        <strong>{formatChips(sizingAmount, { compact: true })}</strong>
                      </div>
                      <small>
                        {formatChips(actionTray.sizingAction.min, { compact: true })} to{" "}
                        {formatChips(actionTray.sizingAction.max, { compact: true })}
                      </small>
                    </div>

                    {actionTray.sizingAction.presets.length ? (
                      <div className="preset-row">
                        {actionTray.sizingAction.presets.map((amount) => (
                          <button
                            className={Number(betAmount) === amount ? "mode-chip active" : "mode-chip"}
                            key={amount}
                            onClick={() => onActionPreset(amount)}
                            type="button"
                          >
                            {formatChips(amount, { compact: true })}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="sizing-input-row">
                      <input
                        max={actionTray.sizingAction.max}
                        min={actionTray.sizingAction.min}
                        onChange={(event) => onBetAmountChange(event.target.value)}
                        step={1}
                        type="range"
                        value={sizingAmount || actionTray.sizingAction.min}
                      />
                      <input
                        inputMode="numeric"
                        onChange={(event) => onBetAmountChange(event.target.value)}
                        type="text"
                        value={betAmount}
                      />
                      <button
                        className="primary-button tray-action-button"
                        onClick={() => onActionIntent(actionTray.sizingAction!.actionType)}
                        type="button"
                      >
                        {actionTray.sizingAction.actionType === "BET" ? "Bet" : "Raise"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="tray-button-row">
                <button
                  className="secondary-button tray-action-button"
                  disabled={!canControlSeat || liveSnapshot.tablePhase === "HAND_ACTIVE"}
                  onClick={onReadyForHand}
                  type="button"
                >
                  Ready for hand
                </button>
                <button
                  className="ghost-button tray-action-button"
                  disabled={!canControlSeat}
                  onClick={onSitOutNextHand}
                  type="button"
                >
                  Sit out next hand
                </button>
                <button
                  className="ghost-button tray-action-button"
                  disabled={!canControlSeat}
                  onClick={onSitOutNow}
                  type="button"
                >
                  Sit out now
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          description="Create or join a room and the websocket client will subscribe automatically."
          eyebrow="Realtime"
          muted
          title="No live room snapshot yet"
        />
      )}
    </article>
  );
}

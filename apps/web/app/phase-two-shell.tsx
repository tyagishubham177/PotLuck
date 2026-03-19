"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  actionRejectedEventSchema,
  adminOtpRequestResponseSchema,
  apiErrorSchema,
  authSessionResponseSchema,
  authStatusResponseSchema,
  buyInResponseSchema,
  buyInQuoteResponseSchema,
  joinRoomResponseSchema,
  lobbySnapshotSchema,
  logoutResponseSchema,
  queueJoinResponseSchema,
  rebuyResponseSchema,
  realtimeServerMessageSchema,
  roomCreateResponseSchema,
  roomRealtimeSnapshotSchema,
  roomPublicSummarySchema,
  roomPrivateStateSchema,
  seatReservationResponseSchema,
  topUpResponseSchema,
  type AuthActor,
  type HandTranscript,
  type LobbySnapshot,
  type RoomConfig,
  type RoomJoinMode,
  type RoomPrivateState,
  type RoomPublicSummary,
  type RoomRealtimeSnapshot,
  type SettlementPostedEvent,
  type SessionEnvelope,
  type ShowdownResultEvent
} from "@potluck/contracts";

import {
  applyRoomDiff,
  authSessionSyncStorageKey,
  createAuthStateSyncMarker,
  shouldRefreshAuthStateFromSyncMarker,
  shouldResetRoomState,
  toWebSocketUrl
} from "./room-realtime";
import {
  buildSeatViewModels,
  clampActionAmount,
  formatChips,
  formatCountdown,
  getActionTrayState,
  getDefaultActionAmount
} from "./table-state";

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
type SocketStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";
type PlayerRealtimeAction = "CHECK" | "FOLD" | "CALL" | "BET" | "RAISE" | "ALL_IN";
type ChipOperation = "BUY_IN" | "TOP_UP" | "REBUY";

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

const suitSymbols: Record<string, string> = {
  C: "♣",
  D: "♦",
  H: "♥",
  S: "♠"
};

function CardFace({
  card,
  hidden = false,
  winning = false
}: {
  card?: string;
  hidden?: boolean;
  winning?: boolean;
}) {
  if (hidden || !card) {
    return (
      <div className="playing-card hidden" aria-hidden="true">
        <span className="card-back-pattern" />
      </div>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const isRed = suit === "D" || suit === "H";

  return (
    <div className={`playing-card${isRed ? " suit-red" : ""}${winning ? " is-winning" : ""}`}>
      <span className="card-rank">{rank}</span>
      <span className="card-suit">{suitSymbols[suit] ?? suit}</span>
    </div>
  );
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
  const [liveSnapshot, setLiveSnapshot] = useState<RoomRealtimeSnapshot | null>(null);
  const [privateState, setPrivateState] = useState<RoomPrivateState | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("idle");
  const [socketFeedback, setSocketFeedback] = useState<ProcessFeedback | null>(null);
  const [stackAmount, setStackAmount] = useState("");
  const [chipFeedback, setChipFeedback] = useState<ProcessFeedback | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [showdownResult, setShowdownResult] = useState<ShowdownResultEvent | null>(null);
  const [settlementPosted, setSettlementPosted] = useState<SettlementPostedEvent | null>(null);
  const [handHistory, setHandHistory] = useState<HandTranscript | null>(null);
  const authStateRef = useRef<AuthState>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const authSyncInFlightRef = useRef<Promise<AuthState> | null>(null);

  function clearRoomSessionState(options: { keepRoomCode?: string } = {}) {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    reconnectAttemptRef.current = 0;

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      socketRef.current.close();
    }

    socketRef.current = null;
    setRoomPreview(null);
    setLobbySnapshot(null);
    setLiveSnapshot(null);
    setPrivateState(null);
    setSocketStatus("idle");
    setSocketFeedback(null);
    setStackAmount("");
    setChipFeedback(null);
    setBetAmount("");
    setShowdownResult(null);
    setSettlementPosted(null);
    setHandHistory(null);

    if (options.keepRoomCode !== undefined) {
      setRoomCode(options.keepRoomCode);
    }
  }

  function applyAuthState(nextState: AuthState) {
    if (shouldResetRoomState(authStateRef.current, nextState)) {
      clearRoomSessionState();
    }

    authStateRef.current = nextState;
    setAuthState(nextState);
  }

  function broadcastAuthStateChange(nextState: AuthState) {
    try {
      window.localStorage.setItem(
        authSessionSyncStorageKey,
        createAuthStateSyncMarker(nextState)
      );
    } catch {
      // Ignore storage failures so auth mutations still complete.
    }
  }

  async function synchronizeAuthState() {
    if (authSyncInFlightRef.current) {
      return authSyncInFlightRef.current;
    }

    const task = (async () => {
      try {
        const response = await apiRequest(serverOrigin, "/api/auth/session", authStatusResponseSchema);

        if (!response.authenticated || !response.session || !response.actor) {
          applyAuthState(null);
          return null;
        }

        const nextState = { session: response.session, actor: response.actor };
        applyAuthState(nextState);

        if (nextState.actor.role === "GUEST") {
          setRoomCode(nextState.actor.roomCode);
          try {
            await loadLobby(nextState.actor.roomId);
          } catch {
            clearRoomSessionState({ keepRoomCode: nextState.actor.roomCode });
          }
        }

        return nextState;
      } catch {
        applyAuthState(null);
        return null;
      }
    })();

    authSyncInFlightRef.current = task;

    try {
      return await task;
    } finally {
      if (authSyncInFlightRef.current === task) {
        authSyncInFlightRef.current = null;
      }
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
        await synchronizeAuthState();
      } finally {
        setIsBooting(false);
      }
    })();
  }, [serverOrigin]);

  useEffect(() => {
    function handleVisibleSessionSync() {
      if (document.visibilityState !== "visible") {
        return;
      }

      void synchronizeAuthState();
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== authSessionSyncStorageKey) {
        return;
      }

      if (!shouldRefreshAuthStateFromSyncMarker(authStateRef.current, event.newValue)) {
        return;
      }

      void synchronizeAuthState();
    }

    window.addEventListener("focus", handleVisibleSessionSync);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibleSessionSync);

    return () => {
      window.removeEventListener("focus", handleVisibleSessionSync);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibleSessionSync);
    };
  }, [serverOrigin]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeRoomId =
    authState?.actor.role === "GUEST"
      ? authState.actor.roomId
      : liveSnapshot?.room.roomId ?? lobbySnapshot?.room.roomId;

  useEffect(() => {
    function clearReconnectTimer() {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    if (!authState || !activeRoomId) {
      clearReconnectTimer();
      socketRef.current?.close();
      socketRef.current = null;
      setLiveSnapshot(null);
      setPrivateState(null);
      setSocketStatus("idle");
      setSocketFeedback(null);
      return;
    }

    let disposed = false;

    const connect = () => {
      if (disposed) {
        return;
      }

      clearReconnectTimer();
      setSocketStatus(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");
      setSocketFeedback({
        tone: "pending",
        message:
          reconnectAttemptRef.current > 0
            ? "Reconnecting to the live room actor."
            : "Connecting to the live room actor."
      });

      const socket = new WebSocket(toWebSocketUrl(serverOrigin));
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (disposed) {
          socket.close();
          return;
        }

        socket.send(JSON.stringify({ type: "ROOM_SUBSCRIBE", roomId: activeRoomId }));
      });

      socket.addEventListener("message", (event) => {
        try {
          const message = realtimeServerMessageSchema.parse(JSON.parse(event.data));

          if (message.type === "ROOM_SNAPSHOT") {
            reconnectAttemptRef.current = 0;
            const snapshot = roomRealtimeSnapshotSchema.parse(message.snapshot);
            setLiveSnapshot(snapshot);
            setPrivateState(null);
            setRoomPreview(snapshot.room);
            if (snapshot.activeHand) {
              setShowdownResult(null);
              setSettlementPosted(null);
              setHandHistory(null);
            }
            setSocketStatus("connected");
            setSocketFeedback({
              tone: "success",
              message: `Live room actor connected at event ${snapshot.roomEventNo}.`
            });
            return;
          }

          if (message.type === "ROOM_DIFF") {
            setLiveSnapshot((current) =>
              current ? applyRoomDiff(current, message.diff, message.roomEventNo) : current
            );

            if (message.diff.room) {
              setRoomPreview(message.diff.room);
            }

            return;
          }

          if (message.type === "PRIVATE_STATE") {
            setPrivateState(roomPrivateStateSchema.parse(message.privateState));
            return;
          }

          if (message.type === "HAND_STARTED") {
            setShowdownResult(null);
            setSettlementPosted(null);
            setHandHistory(null);
            setSocketFeedback({
              tone: "pending",
              message: `Hand ${message.handNumber} started.`
            });
            return;
          }

          if (message.type === "TURN_STARTED") {
            setSocketFeedback({
              tone: "pending",
              message: `Seat ${message.actingSeatIndex + 1} is on the clock.`
            });
            return;
          }

          if (message.type === "ACTION_ACCEPTED") {
            setSocketFeedback({
              tone: "success",
              message: `${message.actionType.replaceAll("_", " ")} accepted at hand seq ${message.handSeq}.`
            });
            return;
          }

          if (message.type === "ACTION_REJECTED") {
            const rejected = actionRejectedEventSchema.parse(message);
            setSocketFeedback({
              tone: "error",
              message: `${rejected.errorCode}: ${rejected.message}`
            });
            return;
          }

          if (message.type === "TURN_WARNING") {
            setSocketFeedback({
              tone: "pending",
              message: `Seat ${message.actingSeatIndex + 1} has ${message.secondsRemaining}s left.`
            });
            return;
          }

          if (message.type === "STREET_ADVANCED") {
            setSocketFeedback({
              tone: "success",
              message: `${message.street} dealt: ${message.revealedCards.join(" ")}.`
            });
            return;
          }

          if (message.type === "SHOWDOWN_RESULT") {
            setShowdownResult(message);
            setSocketFeedback({
              tone: "success",
              message: message.awardedByFold
                ? `Hand awarded without showdown across ${message.pots.length} pot(s).`
                : `Showdown resolved across ${message.pots.length} pot(s).`
            });
            return;
          }

          if (message.type === "SETTLEMENT_POSTED") {
            setSettlementPosted(message);
            setSocketFeedback({
              tone: "success",
              message: `Settlement posted for ${message.settlement.totalPot.toLocaleString()} chips.`
            });
            return;
          }

          if (message.type === "HAND_HISTORY") {
            setHandHistory(message.transcript);
            setSocketFeedback({
              tone: "success",
              message: `History loaded for hand ${message.transcript.handId}.`
            });
            return;
          }

          if (message.type === "PLAYER_DISCONNECTED") {
            setSocketFeedback({
              tone: "error",
              message: `Seat ${message.seatIndex !== undefined ? message.seatIndex + 1 : "?"} disconnected.`
            });
            return;
          }

          if (message.type === "PLAYER_RECONNECTED") {
            setSocketFeedback({
              tone: "success",
              message: `Seat ${message.seatIndex !== undefined ? message.seatIndex + 1 : "?"} reconnected.`
            });
            return;
          }

          if (message.type === "ROOM_PAUSED") {
            setSocketFeedback({
              tone: "error",
              message: message.reason
            });
            return;
          }

          if (message.type === "SERVER_ERROR") {
            setSocketFeedback({
              tone: "error",
              message: `${message.errorCode}: ${message.message}`
            });
          }
        } catch (error) {
          setSocketFeedback({
            tone: "error",
            message: createErrorMessage(error)
          });
        }
      });

      socket.addEventListener("close", () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        if (disposed) {
          return;
        }

        setSocketStatus("reconnecting");
        setSocketFeedback({
          tone: "pending",
          message: "Realtime connection dropped. Retrying now."
        });

        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(
          connect,
          Math.min(5000, reconnectAttemptRef.current * 1000)
        );
      });

      socket.addEventListener("error", () => {
        if (disposed) {
          return;
        }

        setSocketStatus("error");
        setSocketFeedback({
          tone: "error",
          message: "The realtime socket hit a transport error."
        });
      });
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      reconnectAttemptRef.current = 0;
      if (
        socketRef.current &&
        (socketRef.current.readyState === WebSocket.OPEN ||
          socketRef.current.readyState === WebSocket.CONNECTING)
      ) {
        socketRef.current.close();
      }
      socketRef.current = null;
    };
  }, [activeRoomId, authState?.session.sessionId, serverOrigin]);

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
      (liveSnapshot ?? lobbySnapshot)?.heroParticipantId
        ? (liveSnapshot ?? lobbySnapshot)?.participants.find(
            (participant) =>
              participant.participantId === (liveSnapshot ?? lobbySnapshot)?.heroParticipantId
          ) ?? null
        : null,
    [liveSnapshot, lobbySnapshot]
  );

  const derivedBuyInExample =
    roomForm.buyInMode === "BB_MULTIPLE"
      ? `${roomForm.minBuyIn}BB = ${(roomForm.minBuyIn * roomForm.bigBlind).toLocaleString()} chips`
      : `${roomForm.minBuyIn.toLocaleString()} chips`;

  const heroSeatIndex =
    privateState?.seatIndex ?? liveSnapshot?.heroSeatIndex ?? lobbySnapshot?.heroSeatIndex;

  const tableSeatModels = useMemo(
    () => (liveSnapshot ? buildSeatViewModels(liveSnapshot, privateState, nowMs) : []),
    [liveSnapshot, nowMs, privateState]
  );

  const actionAffordances = privateState?.actionAffordances ?? null;
  const actionTray = useMemo(
    () => getActionTrayState(liveSnapshot?.activeHand, actionAffordances),
    [actionAffordances, liveSnapshot?.activeHand]
  );

  const currentSeatSnapshot =
    heroSeatIndex !== undefined
      ? (liveSnapshot?.seats ?? lobbySnapshot?.seats ?? []).find(
          (seat) => seat.seatIndex === heroSeatIndex
        ) ?? null
      : null;

  const stackControlQuote = liveSnapshot?.buyInQuote ?? lobbySnapshot?.buyInQuote ?? null;
  const stackControlConfig = liveSnapshot?.config ?? lobbySnapshot?.config ?? null;
  const currentTablePhase = liveSnapshot?.tablePhase ?? "BETWEEN_HANDS";

  const chipControlState = useMemo(() => {
    const isGuestPlayer =
      authState?.actor.role === "GUEST" && authState.actor.mode === "PLAYER" && heroSeatIndex !== undefined;
    const seatStatus = currentSeatSnapshot?.status;
    const seatStack = currentSeatSnapshot?.stack ?? 0;
    const betweenHands = currentTablePhase === "BETWEEN_HANDS";

    return {
      canBuyIn: Boolean(isGuestPlayer && seatStatus === "RESERVED" && stackControlQuote),
      canTopUp: Boolean(
        isGuestPlayer &&
          seatStatus === "OCCUPIED" &&
          seatStack > 0 &&
          betweenHands &&
          stackControlConfig?.topUpEnabled
      ),
      canRebuy: Boolean(
        isGuestPlayer &&
          seatStatus === "OCCUPIED" &&
          seatStack === 0 &&
          betweenHands &&
          stackControlConfig?.rebuyEnabled
      )
    };
  }, [
    authState,
    currentSeatSnapshot?.stack,
    currentSeatSnapshot?.status,
    currentTablePhase,
    heroSeatIndex,
    stackControlConfig?.rebuyEnabled,
    stackControlConfig?.topUpEnabled,
    stackControlQuote
  ]);

  useEffect(() => {
    const nextDefault = getDefaultActionAmount(actionAffordances);

    setBetAmount((current) => {
      if (!actionAffordances) {
        return "";
      }

      const numericCurrent = Number(current);
      const clamped = clampActionAmount(numericCurrent, actionAffordances);

      if (!current || numericCurrent !== clamped) {
        return nextDefault;
      }

      return current;
    });
  }, [actionAffordances]);

  useEffect(() => {
    if (!stackControlQuote) {
      return;
    }

    setStackAmount((current) => current || String(stackControlQuote.minChips));
  }, [stackControlQuote?.minChips]);

  const activeCallAmount = actionAffordances?.callAmount ?? 0;
  const sizingAmount = clampActionAmount(Number(betAmount), actionAffordances);
  const settlementSummary = settlementPosted?.settlement ?? null;
  const showdownWinners = new Set(showdownResult?.pots.flatMap((pot) => pot.winnerSeatIndexes) ?? []);
  const activeHand = liveSnapshot?.activeHand ?? null;
  const boardCards = activeHand?.board ?? [];
  const potBadges = settlementSummary
    ? settlementSummary.pots.map((pot) => ({
        key: `${settlementSummary.handId}-${pot.potIndex}`,
        label: pot.potType === "MAIN" ? "Main pot" : `Side pot ${pot.potIndex + 1}`,
        amount: pot.amount
      }))
    : activeHand && activeHand.potTotal > 0
      ? [
          {
            key: activeHand.handId,
            label: "Pot",
            amount: activeHand.potTotal
          }
        ]
      : [];
  const reconnectCopy = privateState?.reconnect.isReconnecting
    ? `Reconnect grace ends ${privateState.reconnect.reconnectGraceEndsAt ? formatCountdown(privateState.reconnect.reconnectGraceEndsAt, nowMs) : "soon"}.`
    : socketStatus === "reconnecting"
      ? "Trying to resume the live room stream."
      : null;

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

  function sendRealtimeMessage(payload: Record<string, unknown>) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setSocketFeedback({
        tone: "error",
        message: "Live room actor is not connected yet."
      });
      return;
    }

    socketRef.current.send(JSON.stringify(payload));
  }

  function handleReadyForHand() {
    if (authState?.actor.role !== "GUEST" || !activeRoomId) {
      return;
    }

    sendRealtimeMessage({
      type: "PLAYER_READY",
      roomId: activeRoomId,
      seatIndex: privateState?.seatIndex
    });
  }

  function handleSitOutNow() {
    if (authState?.actor.role !== "GUEST" || !activeRoomId) {
      return;
    }

    sendRealtimeMessage({
      type: "PLAYER_SIT_OUT",
      roomId: activeRoomId,
      effectiveTiming: "NOW"
    });
  }

  function handleSitOutNextHand() {
    if (authState?.actor.role !== "GUEST" || !activeRoomId) {
      return;
    }

    sendRealtimeMessage({
      type: "PLAYER_SIT_OUT",
      roomId: activeRoomId,
      effectiveTiming: "NEXT_HAND"
    });
  }

  function handleSubmitRealtimeAction(actionType: PlayerRealtimeAction, amount?: number) {
    if (
      authState?.actor.role !== "GUEST" ||
      !activeRoomId ||
      !liveSnapshot?.activeHand ||
      !privateState?.actionAffordances
    ) {
      return;
    }

    const payload: Record<string, unknown> = {
      type: "ACTION_SUBMIT",
      roomId: activeRoomId,
      handId: liveSnapshot.activeHand.handId,
      seqExpectation: liveSnapshot.activeHand.handSeq,
      idempotencyKey: `${actionType.toLowerCase()}-${liveSnapshot.activeHand.handId}-${liveSnapshot.activeHand.handSeq}`,
      actionType
    };

    if (amount !== undefined) {
      payload.amount = amount;
    }

    sendRealtimeMessage(payload);
  }

  function handleActionIntent(actionType: PlayerRealtimeAction) {
    if (actionType === "BET" || actionType === "RAISE") {
      handleSubmitRealtimeAction(actionType, sizingAmount);
      return;
    }

    handleSubmitRealtimeAction(actionType);
  }

  function handleActionPreset(amount: number) {
    setBetAmount(String(amount));
  }

  function handleBetAmountChange(value: string) {
    setBetAmount(value.replace(/[^\d]/g, ""));
  }

  function handleStackAmountChange(value: string) {
    setStackAmount(value.replace(/[^\d]/g, ""));
  }

  function handleChipOperation(operation: ChipOperation) {
    if (
      authState?.actor.role !== "GUEST" ||
      !activeRoomId ||
      heroSeatIndex === undefined ||
      !stackControlQuote
    ) {
      return;
    }

    const parsedAmount = Math.min(
      Math.max(Number(stackAmount) || stackControlQuote.minChips, stackControlQuote.minChips),
      stackControlQuote.maxChips
    );

    const path =
      operation === "BUY_IN"
        ? `/api/rooms/${activeRoomId}/buyin`
        : operation === "TOP_UP"
          ? `/api/rooms/${activeRoomId}/topup`
          : `/api/rooms/${activeRoomId}/rebuy`;

    const body =
      operation === "BUY_IN"
        ? { seatIndex: heroSeatIndex, amount: parsedAmount }
        : { amount: parsedAmount };

    const label =
      operation === "BUY_IN" ? "buy-in" : operation === "TOP_UP" ? "top-up" : "rebuy";

    setChipFeedback({
      tone: "pending",
      message: `Posting your ${label} for ${parsedAmount.toLocaleString()} chips.`
    });

    void (async () => {
      try {
        const requestInit = {
          method: "POST",
          headers: {
            "Idempotency-Key": `${label}-${activeRoomId}-${heroSeatIndex}-${parsedAmount}`
          },
          body: JSON.stringify(body)
        } satisfies RequestInit;

        const response =
          operation === "BUY_IN"
            ? await apiRequest(serverOrigin, path, buyInResponseSchema, requestInit)
            : operation === "TOP_UP"
              ? await apiRequest(serverOrigin, path, topUpResponseSchema, requestInit)
              : await apiRequest(serverOrigin, path, rebuyResponseSchema, requestInit);

        setLobbySnapshot(response.lobbySnapshot);
        setRoomPreview(response.lobbySnapshot.room);
        setStackAmount(String(parsedAmount));
        setChipFeedback({
          tone: "success",
          message: `${operation.replace("_", " ")} accepted. Live stack ${response.seat.stack?.toLocaleString() ?? 0}.`
        });
      } catch (error) {
        setChipFeedback({ tone: "error", message: createErrorMessage(error) });
      }
    })();
  }

  function handleRequestLatestHistory() {
    if (!activeRoomId || !settlementSummary) {
      return;
    }

    sendRealtimeMessage({
      type: "HISTORY_REQUEST",
      roomId: activeRoomId,
      handId: settlementSummary.handId
    });
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

        const nextState = { session: response.session, actor: response.actor };
        applyAuthState(nextState);
        broadcastAuthStateChange(nextState);
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
        clearRoomSessionState({ keepRoomCode: roomCode.trim().toUpperCase() });
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

        const nextState = { session: response.session, actor: response.actor };
        applyAuthState(nextState);
        broadcastAuthStateChange(nextState);
        setRoomPreview(response.lobbySnapshot.room);
        setLobbySnapshot(response.lobbySnapshot);
        setJoinRoomFeedback({
          tone: "success",
          message: `Joined ${response.lobbySnapshot.room.tableName}.`
        });
      } catch (error) {
        clearRoomSessionState({ keepRoomCode: roomCode.trim().toUpperCase() });
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
        clearRoomSessionState({ keepRoomCode: roomCode });
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
        const nextState = { session: response.session, actor: response.actor };
        applyAuthState(nextState);
        broadcastAuthStateChange(nextState);
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
        clearRoomSessionState();
        applyAuthState(null);
        broadcastAuthStateChange(null);
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
          <p className="eyebrow">Phase 07</p>
          <h1>{appName} player table, action tray, and showdown flow</h1>
          <p className="hero-text">
            The live room now renders a real player table: legal-action controls, private cards,
            seat status halos, stack management between hands, and post-hand settlement context.
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

      <section className="player-table-shell">
        <article className="panel table-panel">
          <div className="panel-head">
            <p className="eyebrow">Phase 07</p>
            <h2>Player table</h2>
            <p className="panel-copy">
              Mobile-first seat ring, board rail, private pocket cards, and legal-action tray wired
              to the live room actor.
            </p>
          </div>

          <div className="table-pill-row">
            <span className="table-pill">Socket {socketStatus}</span>
            <span className="table-pill">
              Room {liveSnapshot?.room.code ?? roomPreview?.code ?? "Not connected"}
            </span>
            <span className="table-pill">Event {liveSnapshot?.roomEventNo ?? 0}</span>
            <span className="table-pill">Phase {liveSnapshot?.tablePhase ?? "BETWEEN_HANDS"}</span>
          </div>
          <ProcessNotice feedback={socketFeedback} />

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
                    <p className="eyebrow">{activeHand ? activeHand.street : "Between Hands"}</p>
                    <h3 className="table-title">
                      {activeHand
                        ? `Hand ${activeHand.handNumber} · ${activeHand.handId}`
                        : "Waiting for enough ready players"}
                    </h3>
                  </div>
                  <div className="table-pill-row compact">
                    <span className="table-pill">
                      Hero {heroSeatIndex !== undefined ? `Seat ${heroSeatIndex + 1}` : "Observer"}
                    </span>
                    <span className="table-pill">
                      Stack {formatChips(privateState?.stack ?? currentSeatSnapshot?.stack)}
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
                          <div key={pot.key} className="pot-badge">
                            <span>{pot.label}</span>
                            <strong>{formatChips(pot.amount)}</strong>
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
                        <CardFace key={`board-${index}`} card={boardCards[index]} />
                      ))}
                    </div>

                    <div className="board-meta-grid">
                      <div className="board-meta-card">
                        <span>Current bet</span>
                        <strong>{formatChips(activeHand?.currentBet ?? 0)}</strong>
                      </div>
                      <div className="board-meta-card">
                        <span>Min raise</span>
                        <strong>{formatChips(activeHand?.minimumRaiseTo ?? 0)}</strong>
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
                      key={seat.seatIndex}
                      className={`table-seat ${seat.positionClass} tone-${seat.statusTone}${seat.isActing ? " is-acting" : ""}${seat.isFolded ? " is-folded" : ""}`}
                    >
                      <div className="table-seat-head">
                        <span>{seat.title}</span>
                        {seat.badgeLabel ? <strong>{seat.badgeLabel}</strong> : null}
                      </div>
                      <h4>{seat.occupant}</h4>
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
                  <h3>{privateState?.holeCards?.length ? "Pocket cards live" : "Public-only state"}</h3>
                </div>
                <div className="hero-pocket-cards">
                  {privateState?.holeCards?.length ? (
                    privateState.holeCards.map((card) => <CardFace key={card} card={card} />)
                  ) : (
                    <>
                      <CardFace hidden />
                      <CardFace hidden />
                    </>
                  )}
                </div>
                <p className="panel-copy">
                  {privateState?.holeCards?.length
                    ? "These stay anchored near the player edge while public seats only show card backs."
                    : "Spectators and admins keep the same table layout without private information."}
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
                      <span className="table-pill">Call {formatChips(activeCallAmount)}</span>
                    ) : null}
                    {actionAffordances?.allInAmount ? (
                      <span className="table-pill">
                        All-in {formatChips(actionAffordances.allInAmount)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {actionTray.quickActions.length || actionTray.sizingAction ? (
                  <>
                    <div className="tray-button-row">
                      {actionTray.quickActions.map((action) => (
                        <button
                          key={action.actionType}
                          className={`${action.tone}-button tray-action-button`}
                          onClick={() => handleActionIntent(action.actionType)}
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
                            <strong>{formatChips(sizingAmount)}</strong>
                          </div>
                          <small>
                            {formatChips(actionTray.sizingAction.min)} to{" "}
                            {formatChips(actionTray.sizingAction.max)}
                          </small>
                        </div>

                        {actionTray.sizingAction.presets.length ? (
                          <div className="preset-row">
                            {actionTray.sizingAction.presets.map((amount) => (
                              <button
                                key={amount}
                                className={
                                  Number(betAmount) === amount ? "mode-chip active" : "mode-chip"
                                }
                                onClick={() => handleActionPreset(amount)}
                                type="button"
                              >
                                {formatChips(amount)}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className="sizing-input-row">
                          <input
                            max={actionTray.sizingAction.max}
                            min={actionTray.sizingAction.min}
                            onChange={(event) => handleBetAmountChange(event.target.value)}
                            step={1}
                            type="range"
                            value={sizingAmount || actionTray.sizingAction.min}
                          />
                          <input
                            inputMode="numeric"
                            onChange={(event) => handleBetAmountChange(event.target.value)}
                            type="text"
                            value={betAmount}
                          />
                          <button
                            className="primary-button tray-action-button"
                            onClick={() => handleActionIntent(actionTray.sizingAction!.actionType)}
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
                      disabled={
                        authState?.actor.role !== "GUEST" ||
                        privateState?.seatIndex === undefined ||
                        liveSnapshot.tablePhase === "HAND_ACTIVE"
                      }
                      onClick={handleReadyForHand}
                      type="button"
                    >
                      Ready for hand
                    </button>
                    <button
                      className="ghost-button tray-action-button"
                      disabled={authState?.actor.role !== "GUEST" || privateState?.seatIndex === undefined}
                      onClick={handleSitOutNextHand}
                      type="button"
                    >
                      Sit out next hand
                    </button>
                    <button
                      className="ghost-button tray-action-button"
                      disabled={authState?.actor.role !== "GUEST" || privateState?.seatIndex === undefined}
                      onClick={handleSitOutNow}
                      type="button"
                    >
                      Sit out now
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="gate-card muted">
              <p className="eyebrow">Realtime</p>
              <h3>No live room snapshot yet</h3>
              <p>Create or join a room and the websocket client will subscribe automatically.</p>
            </div>
          )}
        </article>

        <aside className="panel table-rail">
          <div className="panel-head">
            <p className="eyebrow">Rail</p>
            <h2>Stack, showdown, and transcript</h2>
          </div>

          <div className="info-block">
            <div className="info-row">
              <span>Hero seat</span>
              <strong>{heroSeatIndex !== undefined ? `Seat ${heroSeatIndex + 1}` : "Observer"}</strong>
            </div>
            <div className="info-row">
              <span>Current stack</span>
              <strong>{formatChips(currentSeatSnapshot?.stack ?? privateState?.stack)}</strong>
            </div>
            <div className="info-row">
              <span>Buy-in window</span>
              <strong>
                {stackControlQuote
                  ? `${formatChips(stackControlQuote.minChips)} to ${formatChips(stackControlQuote.maxChips)}`
                  : "Join a room first"}
              </strong>
            </div>
          </div>

          <div className="stack-control-panel">
            <div className="panel-head compact">
              <p className="eyebrow">Between hands</p>
              <h3>Chip controls</h3>
            </div>
            <label className="field">
              <span>Chip amount</span>
              <input
                inputMode="numeric"
                onChange={(event) => handleStackAmountChange(event.target.value)}
                value={stackAmount}
              />
            </label>
            {stackControlQuote ? (
              <div className="preset-row">
                <button
                  className="mode-chip"
                  onClick={() => setStackAmount(String(stackControlQuote.minChips))}
                  type="button"
                >
                  Min {formatChips(stackControlQuote.minChips)}
                </button>
                <button
                  className="mode-chip"
                  onClick={() =>
                    setStackAmount(
                      String(
                        Math.min(
                          stackControlQuote.maxChips,
                          Math.max(
                            stackControlQuote.minChips,
                            (currentSeatSnapshot?.stack ?? 0) + stackControlQuote.bigBlind * 20
                          )
                        )
                      )
                    )
                  }
                  type="button"
                >
                  Top-up target
                </button>
                <button
                  className="mode-chip"
                  onClick={() => setStackAmount(String(stackControlQuote.maxChips))}
                  type="button"
                >
                  Max {formatChips(stackControlQuote.maxChips)}
                </button>
              </div>
            ) : null}

            <div className="tray-button-row">
              {chipControlState.canBuyIn ? (
                <button className="primary-button tray-action-button" onClick={() => handleChipOperation("BUY_IN")} type="button">
                  Commit buy-in
                </button>
              ) : null}
              {chipControlState.canTopUp ? (
                <button className="secondary-button tray-action-button" onClick={() => handleChipOperation("TOP_UP")} type="button">
                  Top up
                </button>
              ) : null}
              {chipControlState.canRebuy ? (
                <button className="secondary-button tray-action-button" onClick={() => handleChipOperation("REBUY")} type="button">
                  Rebuy
                </button>
              ) : null}
            </div>
            <ProcessNotice feedback={chipFeedback} />
            {!chipControlState.canBuyIn && !chipControlState.canTopUp && !chipControlState.canRebuy ? (
              <p className="panel-copy">
                {heroSeatIndex === undefined
                  ? "Reserve a seat first so stack controls can target the right chair."
                  : currentTablePhase === "HAND_ACTIVE"
                    ? "Top-up and rebuy controls unlock between hands so the live hand stays stable."
                    : "Stack controls will appear here when your seat state allows them."}
              </p>
            ) : null}
          </div>

          <div className="info-block">
            <div className="panel-head compact">
              <p className="eyebrow">Showdown</p>
              <h3>{settlementSummary ? `Hand ${settlementSummary.handNumber}` : "Waiting for result"}</h3>
            </div>
            {showdownResult ? (
              <div className="showdown-grid">
                {showdownResult.results.map((result) => (
                  <div
                    key={result.participantId}
                    className={`showdown-card${showdownWinners.has(result.seatIndex) ? " is-winning" : ""}`}
                  >
                    <div className="showdown-head">
                      <span>
                        Seat {result.seatIndex + 1} ·{" "}
                        {liveSnapshot?.seats[result.seatIndex]?.nickname ?? result.participantId}
                      </span>
                      <strong>{result.rank.label}</strong>
                    </div>
                    <div className="showdown-cards">
                      {result.holeCards.map((card) => (
                        <CardFace key={`${result.participantId}-${card}`} card={card} winning={showdownWinners.has(result.seatIndex)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-copy">
                Winning cards and pot splits will stay here until the next hand starts.
              </p>
            )}

            {settlementSummary ? (
              <div className="settlement-list">
                {settlementSummary.playerResults
                  .slice()
                  .sort((left, right) => right.netResult - left.netResult)
                  .map((result) => (
                    <div key={result.participantId} className="settlement-row">
                      <span>
                        Seat {result.seatIndex + 1} ·{" "}
                        {liveSnapshot?.seats[result.seatIndex]?.nickname ?? result.participantId}
                      </span>
                      <strong className={result.netResult >= 0 ? "delta-positive" : "delta-negative"}>
                        {result.netResult >= 0 ? "+" : ""}
                        {result.netResult.toLocaleString()}
                      </strong>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>

          <div className="info-block">
            <div className="panel-head compact">
              <p className="eyebrow">Transcript</p>
              <h3>{handHistory ? handHistory.handId : "Load the settled hand"}</h3>
            </div>
            {handHistory ? (
              <>
                <div className="info-row">
                  <span>Actions</span>
                  <strong>{handHistory.actions.length}</strong>
                </div>
                <div className="info-row">
                  <span>Board</span>
                  <strong>{handHistory.board.join(" ") || "No board"}</strong>
                </div>
                <div className="info-row">
                  <span>Audit events</span>
                  <strong>{handHistory.auditEvents.length}</strong>
                </div>
              </>
            ) : (
              <p className="panel-copy">
                Request the last settled hand transcript once payouts post.
              </p>
            )}
            <div className="action-row">
              <button
                className="secondary-button"
                disabled={!settlementSummary}
                onClick={handleRequestLatestHistory}
                type="button"
              >
                Load transcript
              </button>
            </div>
          </div>

          <div className="info-block">
            <div className="panel-head compact">
              <p className="eyebrow">Players</p>
              <h3>{liveSnapshot?.participants.length ?? 0} tracked</h3>
            </div>
            {liveSnapshot ? (
              <ul className="participant-list">
                {liveSnapshot.participants.map((participant) => (
                  <li key={participant.participantId}>
                    <span>{participant.nickname}</span>
                    <small>
                      {participant.state}
                      {participant.isReady ? " - Ready" : ""}
                      {participant.isSittingOut ? " - Sitting out" : ""}
                      {!participant.isConnected ? " - Disconnected" : ""}
                      {participant.seatIndex !== undefined ? ` - Seat ${participant.seatIndex + 1}` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-copy">The live participant rail will populate after room subscribe.</p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

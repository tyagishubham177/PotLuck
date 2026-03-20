import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  actionRejectedEventSchema,
  adminOtpRequestResponseSchema,
  authSessionResponseSchema,
  authStatusResponseSchema,
  buyInQuoteResponseSchema,
  buyInResponseSchema,
  handHistoryListResponseSchema,
  handTranscriptSchema,
  joinRoomResponseSchema,
  lobbySnapshotSchema,
  logoutResponseSchema,
  queueJoinResponseSchema,
  rebuyResponseSchema,
  realtimeServerMessageSchema,
  roomConfigUpdateResponseSchema,
  roomCreateResponseSchema,
  roomModerationResponseSchema,
  roomPrivateStateSchema,
  roomPublicSummarySchema,
  roomRealtimeSnapshotSchema,
  seatReservationResponseSchema,
  topUpResponseSchema,
  type HandHistorySummary,
  type HandTranscript,
  type LobbySnapshot,
  type ModerationRecord,
  type RoomConfig,
  type RoomPrivateState,
  type RoomPublicSummary,
  type RoomRealtimeSnapshot,
  type SettlementPostedEvent,
  type ShowdownResultEvent
} from "@potluck/contracts";

import { apiRequest, createErrorMessage } from "../lib/api";
import {
  type AuthState,
  type ChipOperation,
  type FeedbackKey,
  type FeedbackState,
  initialFeedbackState,
  initialPhaseTwoForms,
  type OtpRequestState,
  type PlayerRealtimeAction,
  type ProcessFeedback,
  type SocketStatus
} from "../lib/phase-two-types";
import {
  applyRoomDiff,
  authSessionSyncStorageKey,
  createAuthStateSyncMarker,
  shouldRefreshAuthStateFromSyncMarker,
  shouldResetRoomState,
  toWebSocketUrl
} from "../room-realtime";
import {
  buildSeatViewModels,
  clampActionAmount,
  getActionTrayState,
  getDefaultActionAmount
} from "../table-state";

type PhaseTwoControllerOptions = {
  serverOrigin: string;
};

type ChipControlState = {
  canBuyIn: boolean;
  canTopUp: boolean;
  canRebuy: boolean;
};

export type PhaseTwoController = {
  session: {
    activeRoomId: string | null;
    authState: AuthState;
    handHistory: HandTranscript | null;
    historyItems: HandHistorySummary[];
    historyNextCursor: string | null;
    isBooting: boolean;
    latestModeration: ModerationRecord | null;
    liveSnapshot: RoomRealtimeSnapshot | null;
    lobbySnapshot: LobbySnapshot | null;
    nowMs: number;
    otpRequestState: OtpRequestState;
    privateState: RoomPrivateState | null;
    roomPreview: RoomPublicSummary | null;
    settlementPosted: SettlementPostedEvent | null;
    showdownResult: ShowdownResultEvent | null;
    socketStatus: SocketStatus;
  };
  forms: {
    adminActionReason: string;
    adminCode: string;
    adminEmail: string;
    betAmount: string;
    joinMode: typeof initialPhaseTwoForms.joinMode;
    nickname: string;
    roomCode: string;
    roomForm: RoomConfig;
    stackAmount: string;
    setAdminActionReason: (value: string) => void;
    setAdminCode: (value: string) => void;
    setAdminEmail: (value: string) => void;
    setBetAmount: (value: string) => void;
    setJoinMode: (value: typeof initialPhaseTwoForms.joinMode) => void;
    setNickname: (value: string) => void;
    setRoomCode: (value: string) => void;
    setStackAmount: (value: string) => void;
    updateRoomForm: <K extends keyof RoomConfig>(key: K, value: RoomConfig[K]) => void;
  };
  feedbacks: FeedbackState;
  derived: {
    actionTray: ReturnType<typeof getActionTrayState>;
    activeCallAmount: number;
    activeHand: RoomRealtimeSnapshot["activeHand"] | null;
    boardCards: string[];
    chipControlState: ChipControlState;
    currentSeatSnapshot: RoomRealtimeSnapshot["seats"][number] | null;
    currentTablePhase: RoomRealtimeSnapshot["tablePhase"];
    derivedBuyInExample: string;
    flowStage: "entry" | "admin" | "lobby" | "table";
    heroParticipant: LobbySnapshot["participants"][number] | null;
    heroSeatIndex: number | undefined;
    isAdmin: boolean;
    isSpectatorSession: boolean;
    lockedNotice: string | null;
    potBadges: Array<{ amount: number; key: string; label: string }>;
    reconnectCopy: string | null;
    settlementSummary: SettlementPostedEvent["settlement"] | null;
    showdownWinners: Set<number>;
    sizingAmount: number;
    stackControlQuote: LobbySnapshot["buyInQuote"] | null;
    statusCopy: string;
    tableSeatModels: ReturnType<typeof buildSeatViewModels>;
  };
  actions: {
    copyRoomCode: () => void;
    handleActionIntent: (actionType: PlayerRealtimeAction) => void;
    handleActionPreset: (amount: number) => void;
    handleCheckRoom: () => void;
    handleChipOperation: (operation: ChipOperation) => void;
    handleCreateRoom: () => void;
    handleExportHand: (handId: string, format: "json" | "txt") => void;
    handleJoinQueue: () => void;
    handleJoinRoom: () => void;
    handleKickParticipant: (participantId: string, nicknameLabel: string) => void;
    handleLoadHandTranscript: (handId: string) => void;
    handleLoadHistoryList: (options?: { append?: boolean; cursor?: string }) => void;
    handleLogout: () => void;
    handlePauseResumeRoom: (nextAction: "pause" | "resume") => void;
    handleReadyForHand: () => void;
    handleRefreshLobby: () => void;
    handleRefreshSession: () => void;
    handleRequestLatestHistory: () => void;
    handleRequestOtp: () => void;
    handleReserveSeat: (seatIndex: number) => void;
    handleSaveRoomConfig: () => void;
    handleSitOutNextHand: () => void;
    handleSitOutNow: () => void;
    handleToggleJoinLock: (locked: boolean) => void;
    handleVerifyOtp: () => void;
  };
};

export function usePhaseTwoController({
  serverOrigin
}: PhaseTwoControllerOptions): PhaseTwoController {
  const [authState, setAuthState] = useState<AuthState>(null);
  const [otpRequestState, setOtpRequestState] = useState<OtpRequestState>(null);
  const [roomPreview, setRoomPreview] = useState<RoomPublicSummary | null>(null);
  const [lobbySnapshot, setLobbySnapshot] = useState<LobbySnapshot | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());
  const [liveSnapshot, setLiveSnapshot] = useState<RoomRealtimeSnapshot | null>(null);
  const [privateState, setPrivateState] = useState<RoomPrivateState | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("idle");
  const [showdownResult, setShowdownResult] = useState<ShowdownResultEvent | null>(null);
  const [settlementPosted, setSettlementPosted] = useState<SettlementPostedEvent | null>(null);
  const [handHistory, setHandHistory] = useState<HandTranscript | null>(null);
  const [historyItems, setHistoryItems] = useState<HandHistorySummary[]>([]);
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
  const [latestModeration, setLatestModeration] = useState<ModerationRecord | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackState>(initialFeedbackState);
  const [forms, setForms] = useState(initialPhaseTwoForms);

  const authStateRef = useRef<AuthState>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const authSyncInFlightRef = useRef<Promise<AuthState> | null>(null);
  const copyNoticeTimerRef = useRef<number | null>(null);

  const setFeedback = useCallback((key: FeedbackKey, feedback: ProcessFeedback | null) => {
    setFeedbacks((current) => ({
      ...current,
      [key]: feedback
    }));
  }, []);

  const clearFeedbacks = useCallback((keys: FeedbackKey[]) => {
    setFeedbacks((current) => {
      const nextState = { ...current };

      for (const key of keys) {
        nextState[key] = null;
      }

      return nextState;
    });
  }, []);

  const updateFormValue = useCallback(
    <K extends keyof typeof initialPhaseTwoForms>(key: K, value: (typeof initialPhaseTwoForms)[K]) => {
      setForms((current) => ({
        ...current,
        [key]: value
      }));
    },
    []
  );

  const updateRoomForm = useCallback(<K extends keyof RoomConfig>(key: K, value: RoomConfig[K]) => {
    setForms((current) => ({
      ...current,
      roomForm: {
        ...current.roomForm,
        [key]: value
      }
    }));
  }, []);

  const clearRoomSessionState = useCallback(
    (options: { keepRoomCode?: string } = {}) => {
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
      setShowdownResult(null);
      setSettlementPosted(null);
      setHandHistory(null);
      setHistoryItems([]);
      setHistoryNextCursor(null);
      setLatestModeration(null);
      clearFeedbacks([
        "socket",
        "chip",
        "history",
        "admin",
        "lobby",
        "reserve",
        "queue",
        "copyRoomCode"
      ]);
      setForms((current) => ({
        ...current,
        roomCode: options.keepRoomCode ?? current.roomCode,
        stackAmount: "",
        betAmount: "",
        adminActionReason: ""
      }));
    },
    [clearFeedbacks]
  );

  const applyAuthState = useCallback(
    (nextState: AuthState) => {
      if (shouldResetRoomState(authStateRef.current, nextState)) {
        clearRoomSessionState();
      }

      authStateRef.current = nextState;
      setAuthState(nextState);
    },
    [clearRoomSessionState]
  );

  const broadcastAuthStateChange = useCallback((nextState: AuthState) => {
    try {
      window.localStorage.setItem(
        authSessionSyncStorageKey,
        createAuthStateSyncMarker(nextState)
      );
    } catch {
      // Ignore storage failures so auth mutations still complete.
    }
  }, []);

  const loadLobby = useCallback(
    async (roomId: string) => {
      const snapshot = await apiRequest(serverOrigin, `/api/rooms/${roomId}/lobby`, lobbySnapshotSchema);
      setLobbySnapshot(snapshot);
      setRoomPreview(snapshot.room);
      return snapshot;
    },
    [serverOrigin]
  );

  const synchronizeAuthState = useCallback(async () => {
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
          updateFormValue("roomCode", nextState.actor.roomCode);

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
  }, [applyAuthState, clearRoomSessionState, loadLobby, serverOrigin, updateFormValue]);

  useEffect(() => {
    void (async () => {
      try {
        await synchronizeAuthState();
      } finally {
        setIsBooting(false);
      }
    })();
  }, [synchronizeAuthState]);

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
  }, [synchronizeAuthState]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeRoomId =
    authState?.actor.role === "GUEST"
      ? authState.actor.roomId
      : liveSnapshot?.room.roomId ?? lobbySnapshot?.room.roomId ?? null;

  const applyAuthoritativeSnapshot = useCallback((snapshot: RoomRealtimeSnapshot) => {
    setLiveSnapshot(snapshot);
    setRoomPreview(snapshot.room);
    setLobbySnapshot((current) =>
      current
        ? {
            ...current,
            room: snapshot.room,
            config: snapshot.config,
            seats: snapshot.seats,
            waitingList: snapshot.waitingList,
            participants: snapshot.participants,
            buyInQuote: snapshot.buyInQuote,
            heroParticipantId: snapshot.heroParticipantId,
            heroSeatIndex: snapshot.heroSeatIndex,
            canJoinWaitingList: snapshot.canJoinWaitingList
          }
        : current
    );
  }, []);

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
      setFeedback("socket", null);
      return;
    }

    let disposed = false;

    const connect = () => {
      if (disposed) {
        return;
      }

      clearReconnectTimer();
      setSocketStatus(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");
      setFeedback("socket", {
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
            setFeedback("socket", {
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
            setFeedback("socket", {
              tone: "pending",
              message: `Hand ${message.handNumber} started.`
            });
            return;
          }

          if (message.type === "TURN_STARTED") {
            setFeedback("socket", {
              tone: "pending",
              message: `Seat ${message.actingSeatIndex + 1} is on the clock.`
            });
            return;
          }

          if (message.type === "ACTION_ACCEPTED") {
            setFeedback("socket", {
              tone: "success",
              message: `${message.actionType.replaceAll("_", " ")} accepted at hand seq ${message.handSeq}.`
            });
            return;
          }

          if (message.type === "ACTION_REJECTED") {
            const rejected = actionRejectedEventSchema.parse(message);
            setFeedback("socket", {
              tone: "error",
              message: `${rejected.errorCode}: ${rejected.message}`
            });
            return;
          }

          if (message.type === "TURN_WARNING") {
            setFeedback("socket", {
              tone: "pending",
              message: `Seat ${message.actingSeatIndex + 1} has ${message.secondsRemaining}s left.`
            });
            return;
          }

          if (message.type === "STREET_ADVANCED") {
            setFeedback("socket", {
              tone: "success",
              message: `${message.street} dealt: ${message.revealedCards.join(" ")}.`
            });
            return;
          }

          if (message.type === "SHOWDOWN_RESULT") {
            setShowdownResult(message);
            setFeedback("socket", {
              tone: "success",
              message: message.awardedByFold
                ? `Hand awarded without showdown across ${message.pots.length} pot(s).`
                : `Showdown resolved across ${message.pots.length} pot(s).`
            });
            return;
          }

          if (message.type === "SETTLEMENT_POSTED") {
            setSettlementPosted(message);
            setFeedback("socket", {
              tone: "success",
              message: `Settlement posted for ${message.settlement.totalPot.toLocaleString()} chips.`
            });
            return;
          }

          if (message.type === "HAND_HISTORY") {
            setHandHistory(message.transcript);
            setFeedback("socket", {
              tone: "success",
              message: `History loaded for hand ${message.transcript.handId}.`
            });
            return;
          }

          if (message.type === "PLAYER_DISCONNECTED") {
            setFeedback("socket", {
              tone: "error",
              message: `Seat ${message.seatIndex !== undefined ? message.seatIndex + 1 : "?"} disconnected.`
            });
            return;
          }

          if (message.type === "PLAYER_RECONNECTED") {
            setFeedback("socket", {
              tone: "success",
              message: `Seat ${message.seatIndex !== undefined ? message.seatIndex + 1 : "?"} reconnected.`
            });
            return;
          }

          if (message.type === "ROOM_PAUSED") {
            setFeedback("socket", {
              tone: "error",
              message: message.reason
            });
            return;
          }

          if (message.type === "MODERATION_APPLIED") {
            setLatestModeration(message.moderation);
            setFeedback("socket", {
              tone: "success",
              message: message.moderation.message
            });
            return;
          }

          if (message.type === "SERVER_ERROR") {
            setFeedback("socket", {
              tone: "error",
              message: `${message.errorCode}: ${message.message}`
            });
          }
        } catch (error) {
          setFeedback("socket", {
            tone: "error",
            message: createErrorMessage(error)
          });
        }
      });

      socket.addEventListener("close", (closeEvent) => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        if (disposed) {
          return;
        }

        if (closeEvent.code === 4003) {
          setSocketStatus("error");
          setFeedback("socket", {
            tone: "error",
            message: "This room session is no longer active."
          });
          void synchronizeAuthState();
          return;
        }

        setSocketStatus("reconnecting");
        setFeedback("socket", {
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
        setFeedback("socket", {
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
  }, [activeRoomId, authState, serverOrigin, setFeedback, synchronizeAuthState]);

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

  const heroSeatIndex =
    privateState?.seatIndex ?? liveSnapshot?.heroSeatIndex ?? lobbySnapshot?.heroSeatIndex;

  const actionAffordances = privateState?.actionAffordances ?? null;
  const currentSeatSnapshot =
    heroSeatIndex !== undefined
      ? (liveSnapshot?.seats ?? lobbySnapshot?.seats ?? []).find(
          (seat) => seat.seatIndex === heroSeatIndex
        ) ?? null
      : null;
  const stackControlQuote = liveSnapshot?.buyInQuote ?? lobbySnapshot?.buyInQuote ?? null;
  const stackControlConfig = liveSnapshot?.config ?? lobbySnapshot?.config ?? null;
  const currentTablePhase = liveSnapshot?.tablePhase ?? "BETWEEN_HANDS";
  const activeHand = liveSnapshot?.activeHand ?? null;

  const tableSeatModels = useMemo(
    () => (liveSnapshot ? buildSeatViewModels(liveSnapshot, privateState, nowMs) : []),
    [liveSnapshot, nowMs, privateState]
  );

  const actionTray = useMemo(
    () => getActionTrayState(liveSnapshot?.activeHand, actionAffordances),
    [actionAffordances, liveSnapshot?.activeHand]
  );

  const chipControlState = useMemo(() => {
    const isGuestPlayer =
      authState?.actor.role === "GUEST" &&
      authState.actor.mode === "PLAYER" &&
      heroSeatIndex !== undefined;
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

    setForms((current) => {
      if (!actionAffordances) {
        return {
          ...current,
          betAmount: ""
        };
      }

      const numericCurrent = Number(current.betAmount);
      const clamped = clampActionAmount(numericCurrent, actionAffordances);

      if (!current.betAmount || numericCurrent !== clamped) {
        return {
          ...current,
          betAmount: nextDefault
        };
      }

      return current;
    });
  }, [actionAffordances]);

  useEffect(() => {
    if (!stackControlQuote) {
      return;
    }

    setForms((current) => ({
      ...current,
      stackAmount: current.stackAmount || String(stackControlQuote.minChips)
    }));
  }, [stackControlQuote?.minChips]);

  useEffect(() => {
    const configSource = liveSnapshot?.config ?? lobbySnapshot?.config;

    if (!configSource) {
      return;
    }

    setForms((current) => ({
      ...current,
      roomForm: configSource
    }));
  }, [liveSnapshot?.config, lobbySnapshot?.config]);

  const handleLoadHistoryList = useCallback(
    (options: { append?: boolean; cursor?: string } = {}) => {
      if (!activeRoomId || !authState) {
        return;
      }

      setFeedback("history", {
        tone: "pending",
        message: options.append ? "Loading older hands." : "Loading hand history."
      });

      const query = options.cursor ? `?cursor=${encodeURIComponent(options.cursor)}` : "";

      void (async () => {
        try {
          const response = await apiRequest(
            serverOrigin,
            `/api/rooms/${activeRoomId}/hands${query}`,
            handHistoryListResponseSchema
          );

          setHistoryItems((current) =>
            options.append ? [...current, ...response.items] : response.items
          );
          setHistoryNextCursor(response.nextCursor);
          setFeedback("history", {
            tone: "success",
            message: response.items.length
              ? `Loaded ${response.items.length} hand history entr${response.items.length === 1 ? "y" : "ies"}.`
              : "No completed hands yet."
          });
        } catch (error) {
          setFeedback("history", {
            tone: "error",
            message: createErrorMessage(error)
          });
        }
      })();
    },
    [activeRoomId, authState, serverOrigin, setFeedback]
  );

  useEffect(() => {
    if (!authState || !activeRoomId) {
      return;
    }

    handleLoadHistoryList();
  }, [activeRoomId, authState?.session.sessionId, handleLoadHistoryList]);

  const sendRealtimeMessage = useCallback(
    (payload: Record<string, unknown>) => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        setFeedback("socket", {
          tone: "error",
          message: "Live room actor is not connected yet."
        });
        return;
      }

      socketRef.current.send(JSON.stringify(payload));
    },
    [setFeedback]
  );

  const handleReadyForHand = useCallback(() => {
    if (authState?.actor.role !== "GUEST" || !activeRoomId) {
      return;
    }

    sendRealtimeMessage({
      type: "PLAYER_READY",
      roomId: activeRoomId,
      seatIndex: privateState?.seatIndex
    });
  }, [activeRoomId, authState, privateState?.seatIndex, sendRealtimeMessage]);

  const handleSitOutNow = useCallback(() => {
    if (authState?.actor.role !== "GUEST" || !activeRoomId) {
      return;
    }

    sendRealtimeMessage({
      type: "PLAYER_SIT_OUT",
      roomId: activeRoomId,
      effectiveTiming: "NOW"
    });
  }, [activeRoomId, authState, sendRealtimeMessage]);

  const handleSitOutNextHand = useCallback(() => {
    if (authState?.actor.role !== "GUEST" || !activeRoomId) {
      return;
    }

    sendRealtimeMessage({
      type: "PLAYER_SIT_OUT",
      roomId: activeRoomId,
      effectiveTiming: "NEXT_HAND"
    });
  }, [activeRoomId, authState, sendRealtimeMessage]);

  const handleSubmitRealtimeAction = useCallback(
    (actionType: PlayerRealtimeAction, amount?: number) => {
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
    },
    [activeRoomId, authState, liveSnapshot?.activeHand, privateState?.actionAffordances, sendRealtimeMessage]
  );

  const sizingAmount = clampActionAmount(Number(forms.betAmount), actionAffordances);
  const activeCallAmount = actionAffordances?.callAmount ?? 0;
  const settlementSummary = settlementPosted?.settlement ?? null;
  const showdownWinners = new Set(showdownResult?.pots.flatMap((pot) => pot.winnerSeatIndexes) ?? []);
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
    ? `Reconnect grace ends ${privateState.reconnect.reconnectGraceEndsAt ? new Date(privateState.reconnect.reconnectGraceEndsAt).toLocaleTimeString() : "soon"}.`
    : socketStatus === "reconnecting"
      ? "Trying to resume the live room stream."
      : null;
  const isAdmin = authState?.actor.role === "ADMIN";
  const isSpectatorSession =
    authState?.actor.role === "GUEST" && authState.actor.mode === "SPECTATOR";
  const lockedNotice = liveSnapshot?.room.joinLocked
    ? "New joins are locked right now. Existing seated players can finish normally."
    : null;

  const statusCopy = useMemo(() => {
    if (isBooting) {
      return "Checking for an existing admin or guest session.";
    }

    if (!authState) {
      return "No active session yet. Use OTP to create a room or join one by code.";
    }

    if (authState.actor.role === "ADMIN") {
      return `Admin session active for ${authState.actor.email}.`;
    }

    return `Guest session active for ${authState.actor.nickname} in room ${authState.actor.roomCode}.`;
  }, [authState, isBooting]);

  const derivedBuyInExample =
    forms.roomForm.buyInMode === "BB_MULTIPLE"
      ? `${forms.roomForm.minBuyIn}BB = ${(forms.roomForm.minBuyIn * forms.roomForm.bigBlind).toLocaleString()} chips`
      : `${forms.roomForm.minBuyIn.toLocaleString()} chips`;

  const handleActionIntent = useCallback(
    (actionType: PlayerRealtimeAction) => {
      if (actionType === "BET" || actionType === "RAISE") {
        handleSubmitRealtimeAction(actionType, sizingAmount);
        return;
      }

      handleSubmitRealtimeAction(actionType);
    },
    [handleSubmitRealtimeAction, sizingAmount]
  );

  const handleActionPreset = useCallback(
    (amount: number) => {
      updateFormValue("betAmount", String(amount));
    },
    [updateFormValue]
  );

  const handleChipOperation = useCallback(
    (operation: ChipOperation) => {
      if (
        authState?.actor.role !== "GUEST" ||
        !activeRoomId ||
        heroSeatIndex === undefined ||
        !stackControlQuote
      ) {
        return;
      }

      const parsedAmount = Math.min(
        Math.max(Number(forms.stackAmount) || stackControlQuote.minChips, stackControlQuote.minChips),
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

      setFeedback("chip", {
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
          updateFormValue("stackAmount", String(parsedAmount));
          setFeedback("chip", {
            tone: "success",
            message: `${operation.replace("_", " ")} accepted. Live stack ${response.seat.stack?.toLocaleString() ?? 0}.`
          });
        } catch (error) {
          setFeedback("chip", {
            tone: "error",
            message: createErrorMessage(error)
          });
        }
      })();
    },
    [
      activeRoomId,
      authState,
      forms.stackAmount,
      heroSeatIndex,
      serverOrigin,
      setFeedback,
      stackControlQuote,
      updateFormValue
    ]
  );

  const handleRequestLatestHistory = useCallback(() => {
    if (!activeRoomId || !settlementSummary) {
      return;
    }

    sendRealtimeMessage({
      type: "HISTORY_REQUEST",
      roomId: activeRoomId,
      handId: settlementSummary.handId
    });
  }, [activeRoomId, sendRealtimeMessage, settlementSummary]);

  const handleLoadHandTranscript = useCallback(
    (handId: string) => {
      setFeedback("history", {
        tone: "pending",
        message: `Loading transcript ${handId}.`
      });

      void (async () => {
        try {
          const transcript = await apiRequest(serverOrigin, `/api/hands/${handId}`, handTranscriptSchema);
          setHandHistory(transcript);
          setFeedback("history", {
            tone: "success",
            message: `Transcript ${handId} loaded.`
          });
        } catch (error) {
          setFeedback("history", {
            tone: "error",
            message: createErrorMessage(error)
          });
        }
      })();
    },
    [serverOrigin, setFeedback]
  );

  const handleExportHand = useCallback(
    (handId: string, format: "json" | "txt") => {
      window.open(
        `${serverOrigin}/api/hands/${handId}/export.${format}`,
        "_blank",
        "noopener,noreferrer"
      );
    },
    [serverOrigin]
  );

  const handlePauseResumeRoom = useCallback(
    (nextAction: "pause" | "resume") => {
      if (!activeRoomId || !isAdmin) {
        return;
      }

      setFeedback("admin", {
        tone: "pending",
        message: nextAction === "pause" ? "Pausing the room." : "Resuming the room."
      });

      void (async () => {
        try {
          const path = `/api/rooms/${activeRoomId}/${nextAction}`;
          const snapshot = await apiRequest(serverOrigin, path, roomRealtimeSnapshotSchema, {
            method: "POST",
            body:
              nextAction === "pause"
                ? JSON.stringify({
                    reason:
                      forms.adminActionReason.trim() || "Room manually paused by the admin."
                  })
                : undefined
          });

          applyAuthoritativeSnapshot(snapshot);
          setFeedback("admin", {
            tone: "success",
            message:
              nextAction === "pause"
                ? snapshot.pausedReason ?? "Room paused."
                : "Room resumed and ready for the next safe transition."
          });
        } catch (error) {
          setFeedback("admin", {
            tone: "error",
            message: createErrorMessage(error)
          });
        }
      })();
    },
    [activeRoomId, applyAuthoritativeSnapshot, forms.adminActionReason, isAdmin, serverOrigin, setFeedback]
  );

  const handleToggleJoinLock = useCallback(
    (locked: boolean) => {
      if (!activeRoomId || !isAdmin) {
        return;
      }

      setFeedback("admin", {
        tone: "pending",
        message: locked ? "Locking the room to new joins." : "Unlocking the room."
      });

      void (async () => {
        try {
          const response = await apiRequest(
            serverOrigin,
            `/api/rooms/${activeRoomId}/lock`,
            roomModerationResponseSchema,
            {
              method: "POST",
              body: JSON.stringify({
                locked,
                reason: forms.adminActionReason.trim() || undefined
              })
            }
          );

          applyAuthoritativeSnapshot(response.snapshot);
          setLatestModeration(response.moderation);
          setFeedback("admin", {
            tone: "success",
            message: response.moderation.message
          });
        } catch (error) {
          setFeedback("admin", {
            tone: "error",
            message: createErrorMessage(error)
          });
        }
      })();
    },
    [activeRoomId, applyAuthoritativeSnapshot, forms.adminActionReason, isAdmin, serverOrigin, setFeedback]
  );

  const handleSaveRoomConfig = useCallback(() => {
    if (!activeRoomId || !isAdmin) {
      return;
    }

    setFeedback("admin", {
      tone: "pending",
      message: "Saving between-hand room settings."
    });

    void (async () => {
      try {
        const response = await apiRequest(
          serverOrigin,
          `/api/rooms/${activeRoomId}/config`,
          roomConfigUpdateResponseSchema,
          {
            method: "PATCH",
            body: JSON.stringify({
              tableName: forms.roomForm.tableName,
              smallBlind: forms.roomForm.smallBlind,
              bigBlind: forms.roomForm.bigBlind,
              ante: forms.roomForm.ante,
              buyInMode: forms.roomForm.buyInMode,
              minBuyIn: forms.roomForm.minBuyIn,
              maxBuyIn: forms.roomForm.maxBuyIn,
              rakeEnabled: forms.roomForm.rakeEnabled,
              rakePercent: forms.roomForm.rakePercent,
              rakeCap: forms.roomForm.rakeCap,
              oddChipRule: forms.roomForm.oddChipRule,
              spectatorsAllowed: forms.roomForm.spectatorsAllowed,
              straddleAllowed: forms.roomForm.straddleAllowed,
              rebuyEnabled: forms.roomForm.rebuyEnabled,
              topUpEnabled: forms.roomForm.topUpEnabled,
              seatReservationTimeoutSeconds: forms.roomForm.seatReservationTimeoutSeconds,
              joinCodeExpiryMinutes: forms.roomForm.joinCodeExpiryMinutes,
              waitingListEnabled: forms.roomForm.waitingListEnabled
            })
          }
        );

        applyAuthoritativeSnapshot(response.snapshot);
        setFeedback("admin", {
          tone: "success",
          message: "Room settings updated for the next hand."
        });
      } catch (error) {
        setFeedback("admin", {
          tone: "error",
          message: createErrorMessage(error)
        });
      }
    })();
  }, [activeRoomId, applyAuthoritativeSnapshot, forms.roomForm, isAdmin, serverOrigin, setFeedback]);

  const handleKickParticipant = useCallback(
    (participantId: string, nicknameLabel: string) => {
      if (!activeRoomId || !isAdmin) {
        return;
      }

      setFeedback("admin", {
        tone: "pending",
        message: `Removing ${nicknameLabel} from the room.`
      });

      void (async () => {
        try {
          const response = await apiRequest(
            serverOrigin,
            `/api/rooms/${activeRoomId}/kick`,
            roomModerationResponseSchema,
            {
              method: "POST",
              body: JSON.stringify({
                participantId,
                reason: forms.adminActionReason.trim() || "Removed by the admin."
              })
            }
          );

          applyAuthoritativeSnapshot(response.snapshot);
          setLatestModeration(response.moderation);
          setFeedback("admin", {
            tone: "success",
            message: response.moderation.message
          });
        } catch (error) {
          setFeedback("admin", {
            tone: "error",
            message: createErrorMessage(error)
          });
        }
      })();
    },
    [activeRoomId, applyAuthoritativeSnapshot, forms.adminActionReason, isAdmin, serverOrigin, setFeedback]
  );

  const handleRequestOtp = useCallback(() => {
    setFeedback("requestOtp", {
      tone: "pending",
      message: "Sending your sign-in code now."
    });
    setFeedback("verifyOtp", null);

    void (async () => {
      try {
        const response = await apiRequest(
          serverOrigin,
          "/api/auth/admin/request-otp",
          adminOtpRequestResponseSchema,
          {
            method: "POST",
            body: JSON.stringify({ email: forms.adminEmail })
          }
        );

        setOtpRequestState({
          challengeId: response.challengeId,
          deliveryHint: response.delivery.recipientHint,
          expiresAt: response.expiresAt,
          cooldownSeconds: response.cooldownSeconds
        });
        setFeedback("requestOtp", {
          tone: "success",
          message: `Code sent to ${response.delivery.recipientHint}.`
        });
      } catch (error) {
        setFeedback("requestOtp", {
          tone: "error",
          message: createErrorMessage(error)
        });
      }
    })();
  }, [forms.adminEmail, serverOrigin, setFeedback]);

  const handleVerifyOtp = useCallback(() => {
    if (!otpRequestState) {
      setFeedback("verifyOtp", {
        tone: "error",
        message: "Request a code first so we have an active verification challenge."
      });
      return;
    }

    setFeedback("verifyOtp", {
      tone: "pending",
      message: "Verifying the OTP."
    });

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
              code: forms.adminCode
            })
          }
        );

        const nextState = { session: response.session, actor: response.actor };
        applyAuthState(nextState);
        broadcastAuthStateChange(nextState);
        updateFormValue("adminCode", "");
        setFeedback("verifyOtp", {
          tone: "success",
          message: "Admin session is ready."
        });
      } catch (error) {
        setFeedback("verifyOtp", {
          tone: "error",
          message: createErrorMessage(error)
        });
      }
    })();
  }, [applyAuthState, broadcastAuthStateChange, forms.adminCode, otpRequestState, serverOrigin, setFeedback, updateFormValue]);

  const resetTransientFeedback = useCallback(() => {
    clearFeedbacks(["lookup", "joinRoom", "lobby", "reserve", "queue", "copyRoomCode"]);
  }, [clearFeedbacks]);

  const handleCreateRoom = useCallback(() => {
    setFeedback("createRoom", {
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
          {
            method: "POST",
            body: JSON.stringify(forms.roomForm)
          }
        );

        setRoomPreview(response.room);
        updateFormValue("roomCode", response.room.code);
        setLobbySnapshot(response.lobbySnapshot);
        setFeedback("createRoom", {
          tone: "success",
          message: `Room ${response.room.code} is live and ready for joins.`
        });
      } catch (error) {
        setFeedback("createRoom", {
          tone: "error",
          message: createErrorMessage(error)
        });
      }
    })();
  }, [forms.roomForm, resetTransientFeedback, serverOrigin, setFeedback, updateFormValue]);

  const handleCheckRoom = useCallback(() => {
    setFeedback("lookup", {
      tone: "pending",
      message: "Checking the room code."
    });

    void (async () => {
      try {
        const trimmedRoomCode = forms.roomCode.trim().toUpperCase();
        const summary = await apiRequest(
          serverOrigin,
          `/api/rooms/${encodeURIComponent(trimmedRoomCode)}`,
          roomPublicSummarySchema
        );

        setRoomPreview(summary);
        updateFormValue("roomCode", trimmedRoomCode);
        setFeedback("lookup", {
          tone: "success",
          message: `${summary.tableName} is ready to join.`
        });
      } catch (error) {
        clearRoomSessionState({ keepRoomCode: forms.roomCode.trim().toUpperCase() });
        setFeedback("lookup", {
          tone: "error",
          message: createErrorMessage(error)
        });
      }
    })();
  }, [clearRoomSessionState, forms.roomCode, serverOrigin, setFeedback, updateFormValue]);

  const handleJoinRoom = useCallback(() => {
    setFeedback("joinRoom", {
      tone: "pending",
      message: "Joining the room and loading the lobby."
    });

    void (async () => {
      try {
        const trimmedRoomCode = forms.roomCode.trim().toUpperCase();
        const response = await apiRequest(
          serverOrigin,
          `/api/rooms/${encodeURIComponent(trimmedRoomCode)}/join`,
          joinRoomResponseSchema,
          {
            method: "POST",
            body: JSON.stringify({ nickname: forms.nickname, mode: forms.joinMode })
          }
        );

        const nextState = { session: response.session, actor: response.actor };
        applyAuthState(nextState);
        broadcastAuthStateChange(nextState);
        setRoomPreview(response.lobbySnapshot.room);
        setLobbySnapshot(response.lobbySnapshot);
        updateFormValue("roomCode", trimmedRoomCode);
        setFeedback("joinRoom", {
          tone: "success",
          message: `Joined ${response.lobbySnapshot.room.tableName}.`
        });
      } catch (error) {
        clearRoomSessionState({ keepRoomCode: forms.roomCode.trim().toUpperCase() });
        setFeedback("joinRoom", {
          tone: "error",
          message: createErrorMessage(error)
        });
      }
    })();
  }, [
    applyAuthState,
    broadcastAuthStateChange,
    clearRoomSessionState,
    forms.joinMode,
    forms.nickname,
    forms.roomCode,
    serverOrigin,
    setFeedback,
    updateFormValue
  ]);

  const handleRefreshLobby = useCallback(() => {
    const roomId =
      authState?.actor.role === "GUEST"
        ? authState.actor.roomId
        : lobbySnapshot?.room.roomId;

    if (!roomId) {
      return;
    }

    setFeedback("lobby", {
      tone: "pending",
      message: "Refreshing the latest lobby snapshot."
    });

    void (async () => {
      try {
        await loadLobby(roomId);
        await apiRequest(serverOrigin, `/api/rooms/${roomId}/buyin/quote`, buyInQuoteResponseSchema);
        setFeedback("lobby", {
          tone: "success",
          message: "Lobby snapshot refreshed."
        });
      } catch (error) {
        clearRoomSessionState({ keepRoomCode: forms.roomCode });
        setFeedback("lobby", {
          tone: "error",
          message: createErrorMessage(error)
        });
      }
    })();
  }, [authState, clearRoomSessionState, forms.roomCode, loadLobby, lobbySnapshot?.room.roomId, serverOrigin, setFeedback]);

  const handleReserveSeat = useCallback(
    (seatIndex: number) => {
      const roomId =
        authState?.actor.role === "GUEST" ? authState.actor.roomId : lobbySnapshot?.room.roomId;

      if (!roomId) {
        return;
      }

      setFeedback("reserve", {
        tone: "pending",
        message: `Reserving seat ${seatIndex + 1} and starting the countdown.`
      });

      void (async () => {
        try {
          const response = await apiRequest(
            serverOrigin,
            `/api/rooms/${roomId}/seats/${seatIndex}`,
            seatReservationResponseSchema,
            {
              method: "POST",
              body: JSON.stringify({})
            }
          );

          setLobbySnapshot(response.lobbySnapshot);
          setRoomPreview(response.lobbySnapshot.room);
          setFeedback("reserve", {
            tone: "success",
            message: `Seat ${response.reservedSeatIndex + 1} is reserved until ${new Date(response.reservedUntil).toLocaleTimeString()}.`
          });
        } catch (error) {
          setFeedback("reserve", {
            tone: "error",
            message: createErrorMessage(error)
          });
        }
      })();
    },
    [authState, lobbySnapshot?.room.roomId, serverOrigin, setFeedback]
  );

  const handleJoinQueue = useCallback(() => {
    const roomId =
      authState?.actor.role === "GUEST" ? authState.actor.roomId : lobbySnapshot?.room.roomId;

    if (!roomId) {
      return;
    }

    setFeedback("queue", {
      tone: "pending",
      message: "Joining the waiting list."
    });

    void (async () => {
      try {
        const response = await apiRequest(
          serverOrigin,
          `/api/rooms/${roomId}/queue`,
          queueJoinResponseSchema,
          {
            method: "POST",
            body: JSON.stringify({})
          }
        );

        setLobbySnapshot(response.lobbySnapshot);
        setFeedback("queue", {
          tone: "success",
          message: `Waiting-list position ${response.queueEntry.position} confirmed.`
        });
      } catch (error) {
        setFeedback("queue", {
          tone: "error",
          message: createErrorMessage(error)
        });
      }
    })();
  }, [authState, lobbySnapshot?.room.roomId, serverOrigin, setFeedback]);

  const handleRefreshSession = useCallback(() => {
    setFeedback("refresh", {
      tone: "pending",
      message: "Refreshing the active session."
    });

    void (async () => {
      try {
        const response = await apiRequest(serverOrigin, "/api/auth/refresh", authSessionResponseSchema, {
          method: "POST",
          body: JSON.stringify({})
        });
        const nextState = { session: response.session, actor: response.actor };
        applyAuthState(nextState);
        broadcastAuthStateChange(nextState);
        setFeedback("refresh", {
          tone: "success",
          message: "Session refreshed successfully."
        });
      } catch (error) {
        setFeedback("refresh", {
          tone: "error",
          message: createErrorMessage(error)
        });
      }
    })();
  }, [applyAuthState, broadcastAuthStateChange, serverOrigin, setFeedback]);

  const handleLogout = useCallback(() => {
    setFeedback("logout", {
      tone: "pending",
      message: "Signing out and clearing session cookies."
    });

    void (async () => {
      try {
        await apiRequest(serverOrigin, "/api/auth/logout", logoutResponseSchema, {
          method: "POST",
          body: JSON.stringify({})
        });
        clearRoomSessionState();
        applyAuthState(null);
        broadcastAuthStateChange(null);
        setFeedback("logout", {
          tone: "success",
          message: "Signed out successfully."
        });
      } catch (error) {
        setFeedback("logout", {
          tone: "error",
          message: createErrorMessage(error)
        });
      }
    })();
  }, [applyAuthState, broadcastAuthStateChange, clearRoomSessionState, serverOrigin, setFeedback]);

  const copyRoomCode = useCallback(() => {
    const code = lobbySnapshot?.room.code ?? roomPreview?.code;

    if (!code) {
      return;
    }

    void (async () => {
      try {
        await navigator.clipboard.writeText(code);
        setFeedback("copyRoomCode", {
          tone: "success",
          message: `Room code ${code} copied.`
        });

        if (copyNoticeTimerRef.current !== null) {
          window.clearTimeout(copyNoticeTimerRef.current);
        }

        copyNoticeTimerRef.current = window.setTimeout(() => {
          setFeedback("copyRoomCode", null);
        }, 2500);
      } catch (error) {
        setFeedback("copyRoomCode", {
          tone: "error",
          message: createErrorMessage(error)
        });
      }
    })();
  }, [lobbySnapshot?.room.code, roomPreview?.code, setFeedback]);

  useEffect(() => {
    return () => {
      if (copyNoticeTimerRef.current !== null) {
        window.clearTimeout(copyNoticeTimerRef.current);
      }
    };
  }, []);

  const flowStage: PhaseTwoController["derived"]["flowStage"] = liveSnapshot || activeRoomId
    ? "table"
    : lobbySnapshot || roomPreview
      ? "lobby"
      : authState?.actor.role === "ADMIN"
        ? "admin"
        : "entry";

  return {
    session: {
      activeRoomId,
      authState,
      handHistory,
      historyItems,
      historyNextCursor,
      isBooting,
      latestModeration,
      liveSnapshot,
      lobbySnapshot,
      nowMs,
      otpRequestState,
      privateState,
      roomPreview,
      settlementPosted,
      showdownResult,
      socketStatus
    },
    forms: {
      adminActionReason: forms.adminActionReason,
      adminCode: forms.adminCode,
      adminEmail: forms.adminEmail,
      betAmount: forms.betAmount,
      joinMode: forms.joinMode,
      nickname: forms.nickname,
      roomCode: forms.roomCode,
      roomForm: forms.roomForm,
      stackAmount: forms.stackAmount,
      setAdminActionReason: (value) => updateFormValue("adminActionReason", value),
      setAdminCode: (value) => updateFormValue("adminCode", value),
      setAdminEmail: (value) => updateFormValue("adminEmail", value),
      setBetAmount: (value) => updateFormValue("betAmount", value.replace(/[^\d]/g, "")),
      setJoinMode: (value) => updateFormValue("joinMode", value),
      setNickname: (value) => updateFormValue("nickname", value),
      setRoomCode: (value) => updateFormValue("roomCode", value.toUpperCase()),
      setStackAmount: (value) => updateFormValue("stackAmount", value.replace(/[^\d]/g, "")),
      updateRoomForm
    },
    feedbacks,
    derived: {
      actionTray,
      activeCallAmount,
      activeHand,
      boardCards,
      chipControlState,
      currentSeatSnapshot,
      currentTablePhase,
      derivedBuyInExample,
      flowStage,
      heroParticipant,
      heroSeatIndex,
      isAdmin,
      isSpectatorSession,
      lockedNotice,
      potBadges,
      reconnectCopy,
      settlementSummary,
      showdownWinners,
      sizingAmount,
      stackControlQuote,
      statusCopy,
      tableSeatModels
    },
    actions: {
      copyRoomCode,
      handleActionIntent,
      handleActionPreset,
      handleCheckRoom,
      handleChipOperation,
      handleCreateRoom,
      handleExportHand,
      handleJoinQueue,
      handleJoinRoom,
      handleKickParticipant,
      handleLoadHandTranscript,
      handleLoadHistoryList,
      handleLogout,
      handlePauseResumeRoom,
      handleReadyForHand,
      handleRefreshLobby,
      handleRefreshSession,
      handleRequestLatestHistory,
      handleRequestOtp,
      handleReserveSeat,
      handleSaveRoomConfig,
      handleSitOutNextHand,
      handleSitOutNow,
      handleToggleJoinLock,
      handleVerifyOtp
    }
  };
}

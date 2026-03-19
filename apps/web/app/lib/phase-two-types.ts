import type { AuthActor, RoomConfig, RoomJoinMode, SessionEnvelope } from "@potluck/contracts";

export type PhaseTwoShellProps = {
  appName: string;
  appOrigin: string;
  serverOrigin: string;
  envName: string;
  statusLabel: string;
};

export type AuthState = {
  session: SessionEnvelope;
  actor: AuthActor;
} | null;

export type OtpRequestState = {
  challengeId: string;
  deliveryHint: string;
  expiresAt: string;
  cooldownSeconds: number;
} | null;

export type ProcessTone = "idle" | "pending" | "success" | "error";

export type ProcessFeedback = {
  tone: Exclude<ProcessTone, "idle">;
  message: string;
};

export type SocketStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export type PlayerRealtimeAction =
  | "CHECK"
  | "FOLD"
  | "CALL"
  | "BET"
  | "RAISE"
  | "ALL_IN";

export type ChipOperation = "BUY_IN" | "TOP_UP" | "REBUY";

export type FeedbackState = {
  requestOtp: ProcessFeedback | null;
  verifyOtp: ProcessFeedback | null;
  createRoom: ProcessFeedback | null;
  lookup: ProcessFeedback | null;
  joinRoom: ProcessFeedback | null;
  lobby: ProcessFeedback | null;
  reserve: ProcessFeedback | null;
  queue: ProcessFeedback | null;
  refresh: ProcessFeedback | null;
  logout: ProcessFeedback | null;
  socket: ProcessFeedback | null;
  chip: ProcessFeedback | null;
  history: ProcessFeedback | null;
  admin: ProcessFeedback | null;
  copyRoomCode: ProcessFeedback | null;
};

export type FeedbackKey = keyof FeedbackState;

export const initialFeedbackState: FeedbackState = {
  requestOtp: null,
  verifyOtp: null,
  createRoom: null,
  lookup: null,
  joinRoom: null,
  lobby: null,
  reserve: null,
  queue: null,
  refresh: null,
  logout: null,
  socket: null,
  chip: null,
  history: null,
  admin: null,
  copyRoomCode: null
};

export const initialRoomForm: RoomConfig = {
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

export type PhaseTwoForms = {
  adminEmail: string;
  adminCode: string;
  roomCode: string;
  nickname: string;
  joinMode: RoomJoinMode;
  roomForm: RoomConfig;
  stackAmount: string;
  betAmount: string;
  adminActionReason: string;
};

export const initialPhaseTwoForms: PhaseTwoForms = {
  adminEmail: "host@example.com",
  adminCode: "",
  roomCode: "",
  nickname: "RiverKid",
  joinMode: "PLAYER",
  roomForm: initialRoomForm,
  stackAmount: "",
  betAmount: "",
  adminActionReason: ""
};

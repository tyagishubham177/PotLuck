import { z } from "zod";

const isoTimestampSchema = z.string().datetime({ offset: true });

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("potluck-server"),
  environment: z.enum(["development", "test", "production"]),
  appOrigin: z.string().url(),
  engine: z.string().min(1)
});

export const roomStatusSchema = z.enum(["CREATED", "OPEN", "PAUSED", "CLOSED"]);
export const roomJoinModeSchema = z.enum(["PLAYER", "SPECTATOR"]);
export const sessionRoleSchema = z.enum(["ADMIN", "GUEST"]);
export const roomVariantSchema = z.literal("HOLD_EM_NL");
export const buyInModeSchema = z.enum(["BB_MULTIPLE", "ABSOLUTE"]);
export const oddChipRuleSchema = z.literal("LEFT_OF_BUTTON");
export const seatStatusSchema = z.enum([
  "EMPTY",
  "RESERVED",
  "OCCUPIED",
  "LOCKED_DURING_HAND"
]);
export const participantStateSchema = z.enum([
  "LOBBY",
  "SPECTATING",
  "RESERVED",
  "SEATED",
  "QUEUED"
]);

export const errorCodeSchema = z.enum([
  "ERR_ROOM_NOT_FOUND",
  "ERR_ROOM_CLOSED",
  "ERR_ROOM_FULL",
  "ERR_QUEUE_FULL",
  "ERR_SEAT_TAKEN",
  "ERR_SEAT_LOCKED",
  "ERR_ALREADY_SEATED",
  "ERR_ALREADY_QUEUED",
  "ERR_JOIN_NAME_CONFLICT",
  "ERR_SPECTATOR_DISABLED",
  "ERR_AUTH_REQUIRED",
  "ERR_OTP_INVALID",
  "ERR_OTP_EXPIRED",
  "ERR_RATE_LIMITED",
  "ERR_FORBIDDEN",
  "ERR_INTERNAL",
  "ERR_EMAIL_DELIVERY_FAILED",
  "ERR_NOT_YOUR_TURN",
  "ERR_ACTION_INVALID",
  "ERR_ACTION_TIMEOUT",
  "ERR_STALE_SEQUENCE",
  "ERR_INSUFFICIENT_STACK",
  "ERR_MIN_RAISE",
  "ERR_MIN_BUYIN",
  "ERR_MAX_BUYIN",
  "ERR_TOPUP_DURING_HAND",
  "ERR_REBUY_DISABLED",
  "ERR_LEDGER_COMMIT_FAILED",
  "ERR_ROOM_PAUSED",
  "ERR_CONFIG_EDIT_DURING_HAND",
  "ERR_ACTIVE_ROOM_EXISTS"
]);

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
    statusCode: z.number().int().min(400).max(599),
    retryable: z.boolean(),
    details: z.record(z.string(), z.string()).optional()
  })
});

export const adminOtpRequestSchema = z.object({
  email: z.string().email()
});

export const adminOtpRequestResponseSchema = z.object({
  challengeId: z.string().min(1),
  cooldownSeconds: z.number().int().nonnegative(),
  expiresAt: isoTimestampSchema,
  delivery: z.object({
    channel: z.literal("email"),
    recipientHint: z.string().min(3)
  })
});

export const adminOtpVerifyRequestSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/)
});

export const roomConfigSchema = z
  .object({
    tableName: z.string().trim().min(3).max(40),
    maxSeats: z.number().int().min(2).max(9).default(6),
    variant: roomVariantSchema.default("HOLD_EM_NL"),
    smallBlind: z.number().int().positive().default(50),
    bigBlind: z.number().int().positive().default(100),
    ante: z.number().int().min(0).default(0),
    buyInMode: buyInModeSchema.default("BB_MULTIPLE"),
    minBuyIn: z.number().int().positive().default(40),
    maxBuyIn: z.number().int().positive().default(250),
    rakeEnabled: z.boolean().default(false),
    rakePercent: z.number().min(0).max(10).default(0),
    rakeCap: z.number().int().min(0).default(0),
    oddChipRule: oddChipRuleSchema.default("LEFT_OF_BUTTON"),
    spectatorsAllowed: z.boolean().default(false),
    straddleAllowed: z.boolean().default(false),
    seatReservationTimeoutSeconds: z.number().int().min(30).max(300).default(120),
    joinCodeExpiryMinutes: z.number().int().min(30).max(1440).default(120),
    waitingListEnabled: z.boolean().default(true),
    roomMaxDurationMinutes: z.number().int().min(720).max(720).default(720)
  })
  .superRefine((value, ctx) => {
    if (value.bigBlind < value.smallBlind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bigBlind"],
        message: "Big blind must be greater than or equal to the small blind."
      });
    }

    if (value.minBuyIn >= value.maxBuyIn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minBuyIn"],
        message: "Min buy-in must be less than max buy-in."
      });
    }
  });

export const roomCreateRequestSchema = roomConfigSchema;

export const roomPublicSummarySchema = z.object({
  roomId: z.string().min(1),
  code: z.string().min(6).max(8),
  tableName: z.string().min(3).max(40),
  status: roomStatusSchema,
  maxSeats: z.number().int().min(2).max(9),
  openSeatCount: z.number().int().min(0),
  reservedSeatCount: z.number().int().min(0),
  occupiedSeatCount: z.number().int().min(0),
  participantCount: z.number().int().min(0),
  queuedCount: z.number().int().min(0),
  spectatorsAllowed: z.boolean(),
  waitingListEnabled: z.boolean(),
  joinCodeExpiresAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
  closesAt: isoTimestampSchema
});

export const seatSnapshotSchema = z.object({
  seatIndex: z.number().int().min(0).max(8),
  status: seatStatusSchema,
  participantId: z.string().min(1).optional(),
  nickname: z.string().min(2).max(20).optional(),
  reservedUntil: isoTimestampSchema.optional(),
  stack: z.number().int().min(0).optional()
});

export const queueEntrySchema = z.object({
  entryId: z.string().min(1),
  participantId: z.string().min(1),
  nickname: z.string().min(2).max(20),
  joinedAt: isoTimestampSchema,
  position: z.number().int().positive()
});

export const buyInQuoteResponseSchema = z.object({
  roomId: z.string().min(1),
  mode: buyInModeSchema,
  minUnits: z.number().int().positive(),
  maxUnits: z.number().int().positive(),
  minChips: z.number().int().positive(),
  maxChips: z.number().int().positive(),
  smallBlind: z.number().int().positive(),
  bigBlind: z.number().int().positive(),
  ante: z.number().int().min(0),
  displayMin: z.string().min(1),
  displayMax: z.string().min(1)
});

export const lobbyParticipantSchema = z.object({
  participantId: z.string().min(1),
  nickname: z.string().min(2).max(20),
  mode: roomJoinModeSchema,
  state: participantStateSchema,
  joinedAt: isoTimestampSchema,
  isConnected: z.boolean(),
  seatIndex: z.number().int().min(0).max(8).optional(),
  reservationExpiresAt: isoTimestampSchema.optional(),
  queuePosition: z.number().int().positive().optional()
});

export const lobbySnapshotSchema = z.object({
  room: roomPublicSummarySchema,
  config: roomConfigSchema,
  seats: z.array(seatSnapshotSchema),
  waitingList: z.array(queueEntrySchema),
  participants: z.array(lobbyParticipantSchema),
  buyInQuote: buyInQuoteResponseSchema,
  heroParticipantId: z.string().min(1).optional(),
  heroSeatIndex: z.number().int().min(0).max(8).optional(),
  canJoinWaitingList: z.boolean()
});

export const sessionEnvelopeSchema = z.object({
  sessionId: z.string().min(1),
  role: sessionRoleSchema,
  issuedAt: isoTimestampSchema,
  expiresAt: isoTimestampSchema,
  refreshExpiresAt: isoTimestampSchema
});

export const adminActorSchema = z.object({
  role: z.literal("ADMIN"),
  adminId: z.string().min(1),
  email: z.string().email()
});

export const guestActorSchema = z.object({
  role: z.literal("GUEST"),
  guestId: z.string().min(1),
  nickname: z.string().min(2).max(20),
  mode: roomJoinModeSchema,
  roomId: z.string().min(1),
  roomCode: z.string().min(6).max(8)
});

export const authActorSchema = z.discriminatedUnion("role", [
  adminActorSchema,
  guestActorSchema
]);

export const authSessionResponseSchema = z.object({
  session: sessionEnvelopeSchema,
  actor: authActorSchema
});

export const authStatusResponseSchema = z.object({
  authenticated: z.boolean(),
  session: sessionEnvelopeSchema.optional(),
  actor: authActorSchema.optional()
});

export const joinRoomRequestSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9 _-]+$/),
  mode: roomJoinModeSchema.default("PLAYER")
});

export const joinRoomResponseSchema = z.object({
  session: sessionEnvelopeSchema,
  actor: guestActorSchema,
  lobbySnapshot: lobbySnapshotSchema
});

export const roomCreateResponseSchema = z.object({
  room: roomPublicSummarySchema,
  lobbySnapshot: lobbySnapshotSchema
});

export const seatReservationRequestSchema = z.object({});

export const seatReservationResponseSchema = z.object({
  reservedSeatIndex: z.number().int().min(0).max(8),
  reservedUntil: isoTimestampSchema,
  buyInQuote: buyInQuoteResponseSchema,
  lobbySnapshot: lobbySnapshotSchema
});

export const queueJoinResponseSchema = z.object({
  queueEntry: queueEntrySchema,
  lobbySnapshot: lobbySnapshotSchema
});

export const logoutResponseSchema = z.object({
  success: z.literal(true)
});

export const clientSnapshotSchema = z.object({
  appName: z.string().min(1),
  appOrigin: z.string().url(),
  serverOrigin: z.string().url(),
  status: z.enum(["foundation-ready", "phase-01-ready", "phase-02-ready"])
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ClientSnapshot = z.infer<typeof clientSnapshotSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type RoomConfig = z.infer<typeof roomConfigSchema>;
export type RoomPublicSummary = z.infer<typeof roomPublicSummarySchema>;
export type SeatSnapshot = z.infer<typeof seatSnapshotSchema>;
export type QueueEntry = z.infer<typeof queueEntrySchema>;
export type BuyInQuote = z.infer<typeof buyInQuoteResponseSchema>;
export type LobbySnapshot = z.infer<typeof lobbySnapshotSchema>;
export type SessionEnvelope = z.infer<typeof sessionEnvelopeSchema>;
export type AuthActor = z.infer<typeof authActorSchema>;
export type RoomJoinMode = z.infer<typeof roomJoinModeSchema>;
export type SessionRole = z.infer<typeof sessionRoleSchema>;

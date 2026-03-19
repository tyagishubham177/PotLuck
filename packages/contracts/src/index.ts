import { z } from "zod";

const isoTimestampSchema = z.string().datetime({ offset: true });

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("potluck-server"),
  environment: z.enum(["development", "test", "production"]),
  appOrigin: z.string().url(),
  engine: z.string().min(1)
});

export const roomStatusSchema = z.enum(["OPEN", "PAUSED", "CLOSED"]);
export const roomJoinModeSchema = z.enum(["PLAYER", "SPECTATOR"]);
export const sessionRoleSchema = z.enum(["ADMIN", "GUEST"]);

export const errorCodeSchema = z.enum([
  "ERR_ROOM_NOT_FOUND",
  "ERR_ROOM_CLOSED",
  "ERR_ROOM_FULL",
  "ERR_QUEUE_FULL",
  "ERR_SEAT_TAKEN",
  "ERR_SEAT_LOCKED",
  "ERR_ALREADY_SEATED",
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
  "ERR_CONFIG_EDIT_DURING_HAND"
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

export const roomPublicSummarySchema = z.object({
  roomId: z.string().min(1),
  code: z.string().min(6).max(8),
  tableName: z.string().min(3).max(40),
  status: roomStatusSchema,
  maxSeats: z.number().int().min(2).max(9),
  openSeatCount: z.number().int().min(0),
  occupantCount: z.number().int().min(0),
  spectatorsAllowed: z.boolean(),
  joinCodeExpiresAt: isoTimestampSchema,
  createdAt: isoTimestampSchema
});

export const lobbyParticipantSchema = z.object({
  participantId: z.string().min(1),
  nickname: z.string().min(2).max(20),
  mode: roomJoinModeSchema,
  state: z.enum(["LOBBY", "SPECTATING"]),
  joinedAt: isoTimestampSchema,
  isConnected: z.boolean()
});

export const lobbySnapshotSchema = z.object({
  room: roomPublicSummarySchema,
  participants: z.array(lobbyParticipantSchema),
  heroParticipantId: z.string().min(1)
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

export const logoutResponseSchema = z.object({
  success: z.literal(true)
});

export const clientSnapshotSchema = z.object({
  appName: z.string().min(1),
  appOrigin: z.string().url(),
  serverOrigin: z.string().url(),
  status: z.enum(["foundation-ready", "phase-01-ready"])
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ClientSnapshot = z.infer<typeof clientSnapshotSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type RoomPublicSummary = z.infer<typeof roomPublicSummarySchema>;
export type LobbySnapshot = z.infer<typeof lobbySnapshotSchema>;
export type SessionEnvelope = z.infer<typeof sessionEnvelopeSchema>;
export type AuthActor = z.infer<typeof authActorSchema>;
export type RoomJoinMode = z.infer<typeof roomJoinModeSchema>;
export type SessionRole = z.infer<typeof sessionRoleSchema>;

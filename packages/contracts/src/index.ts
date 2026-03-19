import { z } from "zod";

const isoTimestampSchema = z.string().datetime({ offset: true });
const seatIndexSchema = z.number().int().min(0).max(8);

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
export const ledgerEntryTypeSchema = z.enum([
  "BUY_IN",
  "REBUY",
  "TOP_UP",
  "HAND_PAYOUT",
  "RAKE",
  "COMPENSATING_ADJUSTMENT"
]);
export const roomTablePhaseSchema = z.enum(["BETWEEN_HANDS", "HAND_ACTIVE"]);
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
export const submittedRoomActionTypeSchema = z.enum([
  "CHECK",
  "FOLD",
  "CALL",
  "BET",
  "RAISE",
  "ALL_IN"
]);
export const roomActionTypeSchema = z.enum([
  "CHECK",
  "FOLD",
  "CALL",
  "BET",
  "RAISE",
  "ALL_IN",
  "TIMEOUT_FOLD"
]);
export const playerSitOutTimingSchema = z.enum(["NOW", "NEXT_HAND"]);
export const cardCodeSchema = z.string().regex(/^(?:[2-9TJQKA][CDHS])$/);
export const handStreetSchema = z.enum(["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"]);
export const handPlayerStatusSchema = z.enum(["ACTIVE", "FOLDED", "ALL_IN"]);
export const forcedCommitmentTypeSchema = z.enum(["ANTE", "SMALL_BLIND", "BIG_BLIND"]);
export const handRankCategorySchema = z.enum([
  "HIGH_CARD",
  "ONE_PAIR",
  "TWO_PAIR",
  "THREE_OF_A_KIND",
  "STRAIGHT",
  "FLUSH",
  "FULL_HOUSE",
  "FOUR_OF_A_KIND",
  "STRAIGHT_FLUSH"
]);
export const settlementPotTypeSchema = z.enum(["MAIN", "SIDE"]);
export const rakeModeSchema = z.literal("PER_HAND");

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
  "ERR_TOPUP_DISABLED",
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
    rebuyEnabled: z.boolean().default(true),
    topUpEnabled: z.boolean().default(true),
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
  seatIndex: seatIndexSchema,
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
  seatIndex: seatIndexSchema.optional(),
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
  heroSeatIndex: seatIndexSchema.optional(),
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
  reservedSeatIndex: seatIndexSchema,
  reservedUntil: isoTimestampSchema,
  buyInQuote: buyInQuoteResponseSchema,
  lobbySnapshot: lobbySnapshotSchema
});

export const queueJoinResponseSchema = z.object({
  queueEntry: queueEntrySchema,
  lobbySnapshot: lobbySnapshotSchema
});

const chipAmountSchema = z.number().int().positive();

export const buyInCommitRequestSchema = z.object({
  seatIndex: seatIndexSchema,
  amount: chipAmountSchema
});

export const rebuyRequestSchema = z.object({
  amount: chipAmountSchema
});

export const topUpRequestSchema = z.object({
  amount: chipAmountSchema
});

export const ledgerEntrySchema = z.object({
  entryId: z.string().min(1),
  roomId: z.string().min(1),
  participantId: z.string().min(1),
  seatIndex: seatIndexSchema.optional(),
  type: ledgerEntryTypeSchema,
  delta: z.number().int(),
  balanceAfter: z.number().int().min(0),
  referenceId: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
  createdAt: isoTimestampSchema
});

export const roomBalanceSummarySchema = z.object({
  roomId: z.string().min(1),
  participantId: z.string().min(1),
  seatIndex: seatIndexSchema.optional(),
  buyInCommitted: z.number().int().min(0),
  rebuyCommitted: z.number().int().min(0),
  topUpCommitted: z.number().int().min(0),
  adjustmentTotal: z.number().int(),
  totalCommitted: z.number().int().min(0),
  netBalance: z.number().int().min(0),
  liveStack: z.number().int().min(0)
});

const chipOperationResponseBaseSchema = z.object({
  tablePhase: roomTablePhaseSchema,
  seat: seatSnapshotSchema,
  ledgerEntry: ledgerEntrySchema,
  balance: roomBalanceSummarySchema,
  lobbySnapshot: lobbySnapshotSchema
});

export const buyInResponseSchema = chipOperationResponseBaseSchema.extend({
  operation: z.literal("BUY_IN")
});

export const rebuyResponseSchema = chipOperationResponseBaseSchema.extend({
  operation: z.literal("REBUY")
});

export const topUpResponseSchema = chipOperationResponseBaseSchema.extend({
  operation: z.literal("TOP_UP")
});

export const roomActionAffordancesSchema = z.object({
  canFold: z.boolean(),
  canCheck: z.boolean(),
  callAmount: z.number().int().min(0).optional(),
  minRaiseTo: z.number().int().min(0).optional(),
  maxRaiseTo: z.number().int().min(0).optional(),
  allInAmount: z.number().int().min(0).optional(),
  presetAmounts: z.array(z.number().int().min(0)).default([])
});

export const roomParticipantRealtimeSchema = lobbyParticipantSchema.extend({
  isReady: z.boolean(),
  isSittingOut: z.boolean(),
  lastDisconnectedAt: isoTimestampSchema.optional(),
  reconnectGraceEndsAt: isoTimestampSchema.optional()
});

export const activeHandPlayerSchema = z.object({
  seatIndex: seatIndexSchema,
  participantId: z.string().min(1),
  status: handPlayerStatusSchema,
  stack: z.number().int().min(0),
  streetCommitted: z.number().int().min(0),
  totalCommitted: z.number().int().min(0),
  hasActed: z.boolean(),
  canRaise: z.boolean()
});

export const activeHandForcedCommitmentSchema = z.object({
  seatIndex: seatIndexSchema,
  participantId: z.string().min(1),
  type: forcedCommitmentTypeSchema,
  amount: z.number().int().min(0)
});

export const activeHandSnapshotSchema = z.object({
  handId: z.string().min(1),
  handNumber: z.number().int().positive(),
  handSeq: z.number().int().nonnegative(),
  street: handStreetSchema,
  buttonSeatIndex: seatIndexSchema.optional(),
  smallBlindSeatIndex: seatIndexSchema.optional(),
  bigBlindSeatIndex: seatIndexSchema.optional(),
  actingSeatIndex: seatIndexSchema.optional(),
  eligibleSeatOrder: z.array(seatIndexSchema),
  foldedSeatIndexes: z.array(seatIndexSchema),
  actedSeatIndexes: z.array(seatIndexSchema),
  board: z.array(cardCodeSchema),
  potTotal: z.number().int().min(0),
  currentBet: z.number().int().min(0),
  minimumRaiseTo: z.number().int().min(0),
  showdownSeatIndexes: z.array(seatIndexSchema),
  showdownRevealOrder: z.array(seatIndexSchema),
  players: z.array(activeHandPlayerSchema),
  forcedCommitments: z.array(activeHandForcedCommitmentSchema),
  winnerByFoldSeatIndex: seatIndexSchema.optional(),
  startedAt: isoTimestampSchema,
  deadlineAt: isoTimestampSchema
});

export const roomRealtimeSnapshotSchema = z.object({
  room: roomPublicSummarySchema,
  config: roomConfigSchema,
  seats: z.array(seatSnapshotSchema),
  waitingList: z.array(queueEntrySchema),
  participants: z.array(roomParticipantRealtimeSchema),
  buyInQuote: buyInQuoteResponseSchema,
  heroParticipantId: z.string().min(1).optional(),
  heroSeatIndex: seatIndexSchema.optional(),
  canJoinWaitingList: z.boolean(),
  tablePhase: roomTablePhaseSchema,
  roomEventNo: z.number().int().nonnegative(),
  activeHand: activeHandSnapshotSchema.nullable().optional(),
  pausedReason: z.string().min(1).nullable().optional()
});

export const roomDiffPatchSchema = z.object({
  room: roomPublicSummarySchema.optional(),
  seats: z.array(seatSnapshotSchema).optional(),
  participants: z.array(roomParticipantRealtimeSchema).optional(),
  waitingList: z.array(queueEntrySchema).optional(),
  buyInQuote: buyInQuoteResponseSchema.optional(),
  tablePhase: roomTablePhaseSchema.optional(),
  activeHand: activeHandSnapshotSchema.nullable().optional(),
  pausedReason: z.string().min(1).nullable().optional()
});

export const roomReconnectMetadataSchema = z.object({
  isReconnecting: z.boolean(),
  disconnectedAt: isoTimestampSchema.optional(),
  reconnectGraceEndsAt: isoTimestampSchema.optional()
});

export const roomPrivateStateSchema = z.object({
  roomId: z.string().min(1),
  participantId: z.string().min(1),
  roomEventNo: z.number().int().nonnegative(),
  seatIndex: seatIndexSchema.optional(),
  stack: z.number().int().min(0).optional(),
  holeCards: z.array(cardCodeSchema).max(2).optional(),
  actionAffordances: roomActionAffordancesSchema.optional(),
  reconnect: roomReconnectMetadataSchema
});

export const handRankSchema = z.object({
  category: handRankCategorySchema,
  label: z.string().min(1),
  comparisonValues: z.array(z.number().int().min(0)),
  bestFiveCards: z.array(cardCodeSchema).length(5)
});

export const showdownResultSchema = z.object({
  seatIndex: seatIndexSchema,
  participantId: z.string().min(1),
  holeCards: z.array(cardCodeSchema).length(2),
  rank: handRankSchema
});

export const settlementPotAwardSchema = z.object({
  seatIndex: seatIndexSchema,
  participantId: z.string().min(1),
  amount: z.number().int().nonnegative()
});

export const settlementPotSchema = z.object({
  potIndex: z.number().int().nonnegative(),
  potType: settlementPotTypeSchema,
  capLevel: z.number().int().nonnegative(),
  amount: z.number().int().nonnegative(),
  contributorSeatIndexes: z.array(seatIndexSchema),
  eligibleSeatIndexes: z.array(seatIndexSchema),
  rakeApplied: z.number().int().nonnegative(),
  winnerSeatIndexes: z.array(seatIndexSchema),
  oddChipSeatIndexes: z.array(seatIndexSchema),
  awards: z.array(settlementPotAwardSchema)
});

export const handSettlementPlayerResultSchema = z.object({
  seatIndex: seatIndexSchema,
  participantId: z.string().min(1),
  contributed: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  finalStack: z.number().int().nonnegative(),
  netResult: z.number().int()
});

export const handSettlementSchema = z.object({
  handId: z.string().min(1),
  handNumber: z.number().int().positive(),
  oddChipRule: oddChipRuleSchema,
  rakeConfig: z.object({
    enabled: z.boolean(),
    percent: z.number().min(0).max(100),
    cap: z.number().int().nonnegative(),
    mode: rakeModeSchema
  }),
  totalPot: z.number().int().nonnegative(),
  totalRake: z.number().int().nonnegative(),
  awardedByFold: z.boolean(),
  showdownResults: z.array(showdownResultSchema),
  pots: z.array(settlementPotSchema),
  playerResults: z.array(handSettlementPlayerResultSchema)
});

export const handActionRecordSchema = z.object({
  seq: z.number().int().positive(),
  seatIndex: seatIndexSchema,
  participantId: z.string().min(1),
  street: z.enum(["PREFLOP", "FLOP", "TURN", "RIVER"]),
  actionType: roomActionTypeSchema,
  normalizedAmount: z.number().int().nonnegative().optional(),
  contributedAmount: z.number().int().nonnegative(),
  totalCommitted: z.number().int().nonnegative(),
  streetCommitted: z.number().int().nonnegative()
});

export const handContributionSchema = z.object({
  seatIndex: seatIndexSchema,
  participantId: z.string().min(1),
  totalCommitted: z.number().int().nonnegative(),
  contributedByStreet: z.object({
    PREFLOP: z.number().int().nonnegative(),
    FLOP: z.number().int().nonnegative(),
    TURN: z.number().int().nonnegative(),
    RIVER: z.number().int().nonnegative()
  })
});

export const handTranscriptAuditEventSchema = z.object({
  eventId: z.string().min(1),
  type: z.string().min(1),
  occurredAt: isoTimestampSchema,
  actorId: z.string().min(1).optional(),
  detail: z.string().min(1)
});

export const handTranscriptSchema = z.object({
  roomId: z.string().min(1),
  handId: z.string().min(1),
  handNumber: z.number().int().positive(),
  buttonSeatIndex: seatIndexSchema.optional(),
  smallBlindSeatIndex: seatIndexSchema.optional(),
  bigBlindSeatIndex: seatIndexSchema.optional(),
  startedAt: isoTimestampSchema,
  endedAt: isoTimestampSchema,
  board: z.array(cardCodeSchema),
  deckCommitmentHash: z.string().min(1),
  deckReveal: z.array(cardCodeSchema),
  actions: z.array(handActionRecordSchema),
  forcedCommitments: z.array(activeHandForcedCommitmentSchema),
  contributions: z.array(handContributionSchema),
  settlement: handSettlementSchema,
  ledgerEntries: z.array(ledgerEntrySchema),
  auditEvents: z.array(handTranscriptAuditEventSchema)
});

export const handHistorySummarySchema = z.object({
  handId: z.string().min(1),
  roomId: z.string().min(1),
  handNumber: z.number().int().positive(),
  startedAt: isoTimestampSchema,
  endedAt: isoTimestampSchema,
  playerCount: z.number().int().nonnegative(),
  totalPot: z.number().int().nonnegative(),
  totalRake: z.number().int().nonnegative(),
  board: z.array(cardCodeSchema)
});

export const handHistoryListResponseSchema = z.object({
  items: z.array(handHistorySummarySchema),
  nextCursor: z.string().min(1).nullable()
});

export const roomSubscribeIntentSchema = z.object({
  type: z.literal("ROOM_SUBSCRIBE"),
  roomId: z.string().min(1)
});

export const roomUnsubscribeIntentSchema = z.object({
  type: z.literal("ROOM_UNSUBSCRIBE"),
  roomId: z.string().min(1)
});

export const playerReadyIntentSchema = z.object({
  type: z.literal("PLAYER_READY"),
  roomId: z.string().min(1),
  seatIndex: seatIndexSchema.optional()
});

export const playerSitOutIntentSchema = z.object({
  type: z.literal("PLAYER_SIT_OUT"),
  roomId: z.string().min(1),
  effectiveTiming: playerSitOutTimingSchema.default("NEXT_HAND")
});

export const actionSubmitIntentSchema = z.object({
  type: z.literal("ACTION_SUBMIT"),
  roomId: z.string().min(1),
  handId: z.string().min(1),
  seqExpectation: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(1),
  actionType: submittedRoomActionTypeSchema,
  amount: z.number().int().min(0).optional()
});

export const historyRequestIntentSchema = z.object({
  type: z.literal("HISTORY_REQUEST"),
  roomId: z.string().min(1),
  handId: z.string().min(1)
});

export const realtimeClientMessageSchema = z.discriminatedUnion("type", [
  roomSubscribeIntentSchema,
  roomUnsubscribeIntentSchema,
  playerReadyIntentSchema,
  playerSitOutIntentSchema,
  actionSubmitIntentSchema,
  historyRequestIntentSchema
]);

const roomEventEnvelopeSchema = z.object({
  roomId: z.string().min(1),
  roomEventNo: z.number().int().nonnegative()
});

const handEventEnvelopeSchema = roomEventEnvelopeSchema.extend({
  handId: z.string().min(1),
  handSeq: z.number().int().nonnegative()
});

export const roomSnapshotEventSchema = roomEventEnvelopeSchema.extend({
  type: z.literal("ROOM_SNAPSHOT"),
  snapshot: roomRealtimeSnapshotSchema
});

export const roomDiffEventSchema = roomEventEnvelopeSchema.extend({
  type: z.literal("ROOM_DIFF"),
  handId: z.string().min(1).optional(),
  handSeq: z.number().int().nonnegative().optional(),
  diff: roomDiffPatchSchema
});

export const privateStateEventSchema = roomEventEnvelopeSchema.extend({
  type: z.literal("PRIVATE_STATE"),
  privateState: roomPrivateStateSchema
});

export const handStartedEventSchema = handEventEnvelopeSchema.extend({
  type: z.literal("HAND_STARTED"),
  handNumber: z.number().int().positive(),
  buttonSeatIndex: seatIndexSchema.optional(),
  blindSeatIndexes: z.array(seatIndexSchema),
  actionSeatOrder: z.array(seatIndexSchema)
});

export const turnStartedEventSchema = handEventEnvelopeSchema.extend({
  type: z.literal("TURN_STARTED"),
  actingSeatIndex: seatIndexSchema,
  deadlineAt: isoTimestampSchema,
  legalActions: roomActionAffordancesSchema
});

export const turnWarningEventSchema = handEventEnvelopeSchema.extend({
  type: z.literal("TURN_WARNING"),
  actingSeatIndex: seatIndexSchema,
  secondsRemaining: z.number().int().nonnegative()
});

export const streetAdvancedEventSchema = handEventEnvelopeSchema.extend({
  type: z.literal("STREET_ADVANCED"),
  street: z.enum(["FLOP", "TURN", "RIVER"]),
  board: z.array(cardCodeSchema),
  revealedCards: z.array(cardCodeSchema).min(1).max(3)
});

export const actionAcceptedEventSchema = handEventEnvelopeSchema.extend({
  type: z.literal("ACTION_ACCEPTED"),
  participantId: z.string().min(1),
  seatIndex: seatIndexSchema,
  idempotencyKey: z.string().min(1),
  actionType: roomActionTypeSchema,
  normalizedAmount: z.number().int().min(0).optional()
});

export const showdownTriggeredEventSchema = handEventEnvelopeSchema.extend({
  type: z.literal("SHOWDOWN_TRIGGERED"),
  board: z.array(cardCodeSchema),
  eligibleSeatIndexes: z.array(seatIndexSchema),
  revealOrder: z.array(seatIndexSchema)
});

export const showdownResultEventSchema = handEventEnvelopeSchema.extend({
  type: z.literal("SHOWDOWN_RESULT"),
  awardedByFold: z.boolean(),
  results: z.array(showdownResultSchema),
  pots: z.array(settlementPotSchema)
});

export const settlementPostedEventSchema = handEventEnvelopeSchema.extend({
  type: z.literal("SETTLEMENT_POSTED"),
  settlement: handSettlementSchema,
  ledgerEntries: z.array(ledgerEntrySchema)
});

export const actionRejectedEventSchema = roomEventEnvelopeSchema.extend({
  type: z.literal("ACTION_REJECTED"),
  handId: z.string().min(1).optional(),
  handSeq: z.number().int().nonnegative().optional(),
  idempotencyKey: z.string().min(1).optional(),
  errorCode: errorCodeSchema,
  message: z.string().min(1),
  expectedSeq: z.number().int().nonnegative().optional()
});

export const playerDisconnectedEventSchema = roomEventEnvelopeSchema.extend({
  type: z.literal("PLAYER_DISCONNECTED"),
  participantId: z.string().min(1),
  seatIndex: seatIndexSchema.optional(),
  disconnectedAt: isoTimestampSchema,
  reconnectGraceEndsAt: isoTimestampSchema.optional()
});

export const playerReconnectedEventSchema = roomEventEnvelopeSchema.extend({
  type: z.literal("PLAYER_RECONNECTED"),
  participantId: z.string().min(1),
  seatIndex: seatIndexSchema.optional(),
  reconnectedAt: isoTimestampSchema
});

export const roomPausedEventSchema = roomEventEnvelopeSchema.extend({
  type: z.literal("ROOM_PAUSED"),
  reason: z.string().min(1),
  recoveryGuidance: z.string().min(1).optional()
});

export const handHistoryEventSchema = roomEventEnvelopeSchema.extend({
  type: z.literal("HAND_HISTORY"),
  transcript: handTranscriptSchema
});

export const serverErrorEventSchema = z.object({
  type: z.literal("SERVER_ERROR"),
  roomId: z.string().min(1).optional(),
  roomEventNo: z.number().int().nonnegative().optional(),
  errorCode: errorCodeSchema,
  message: z.string().min(1)
});

export const realtimeServerMessageSchema = z.discriminatedUnion("type", [
  roomSnapshotEventSchema,
  roomDiffEventSchema,
  privateStateEventSchema,
  handStartedEventSchema,
  turnStartedEventSchema,
  turnWarningEventSchema,
  streetAdvancedEventSchema,
  actionAcceptedEventSchema,
  showdownTriggeredEventSchema,
  showdownResultEventSchema,
  settlementPostedEventSchema,
  actionRejectedEventSchema,
  playerDisconnectedEventSchema,
  playerReconnectedEventSchema,
  roomPausedEventSchema,
  handHistoryEventSchema,
  serverErrorEventSchema
]);

export const logoutResponseSchema = z.object({
  success: z.literal(true)
});

export const clientSnapshotSchema = z.object({
  appName: z.string().min(1),
  appOrigin: z.string().url(),
  serverOrigin: z.string().url(),
  status: z.enum([
    "foundation-ready",
    "phase-01-ready",
    "phase-02-ready",
    "phase-03-ready",
    "phase-04-ready",
    "phase-05-ready",
    "phase-06-ready",
    "phase-07-ready"
  ])
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
export type RoomTablePhase = z.infer<typeof roomTablePhaseSchema>;
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type RoomBalanceSummary = z.infer<typeof roomBalanceSummarySchema>;
export type RoomActionAffordances = z.infer<typeof roomActionAffordancesSchema>;
export type RoomParticipantRealtime = z.infer<typeof roomParticipantRealtimeSchema>;
export type ActiveHandSnapshot = z.infer<typeof activeHandSnapshotSchema>;
export type RoomRealtimeSnapshot = z.infer<typeof roomRealtimeSnapshotSchema>;
export type RoomDiffPatch = z.infer<typeof roomDiffPatchSchema>;
export type RoomPrivateState = z.infer<typeof roomPrivateStateSchema>;
export type HandRank = z.infer<typeof handRankSchema>;
export type ShowdownResult = z.infer<typeof showdownResultSchema>;
export type SettlementPot = z.infer<typeof settlementPotSchema>;
export type HandSettlement = z.infer<typeof handSettlementSchema>;
export type HandTranscript = z.infer<typeof handTranscriptSchema>;
export type HandHistorySummary = z.infer<typeof handHistorySummarySchema>;
export type HandHistoryListResponse = z.infer<typeof handHistoryListResponseSchema>;
export type RealtimeClientMessage = z.infer<typeof realtimeClientMessageSchema>;
export type RoomSnapshotEvent = z.infer<typeof roomSnapshotEventSchema>;
export type RoomDiffEvent = z.infer<typeof roomDiffEventSchema>;
export type PrivateStateEvent = z.infer<typeof privateStateEventSchema>;
export type HandStartedEvent = z.infer<typeof handStartedEventSchema>;
export type TurnStartedEvent = z.infer<typeof turnStartedEventSchema>;
export type TurnWarningEvent = z.infer<typeof turnWarningEventSchema>;
export type StreetAdvancedEvent = z.infer<typeof streetAdvancedEventSchema>;
export type ActionAcceptedEvent = z.infer<typeof actionAcceptedEventSchema>;
export type ShowdownTriggeredEvent = z.infer<typeof showdownTriggeredEventSchema>;
export type ShowdownResultEvent = z.infer<typeof showdownResultEventSchema>;
export type SettlementPostedEvent = z.infer<typeof settlementPostedEventSchema>;
export type ActionRejectedEvent = z.infer<typeof actionRejectedEventSchema>;
export type PlayerDisconnectedEvent = z.infer<typeof playerDisconnectedEventSchema>;
export type PlayerReconnectedEvent = z.infer<typeof playerReconnectedEventSchema>;
export type RoomPausedEvent = z.infer<typeof roomPausedEventSchema>;
export type HandHistoryEvent = z.infer<typeof handHistoryEventSchema>;
export type ServerErrorEvent = z.infer<typeof serverErrorEventSchema>;
export type RealtimeServerMessage = z.infer<typeof realtimeServerMessageSchema>;

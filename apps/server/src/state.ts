import { randomInt, randomUUID } from "node:crypto";

import {
  adminOtpRequestResponseSchema,
  buyInResponseSchema,
  buyInQuoteResponseSchema,
  lobbySnapshotSchema,
  queueEntrySchema,
  rebuyResponseSchema,
  roomConfigSchema,
  roomCreateResponseSchema,
  roomPublicSummarySchema,
  roomBalanceSummarySchema,
  seatReservationResponseSchema,
  topUpResponseSchema,
  type AuthActor,
  type LedgerEntry,
  type LobbySnapshot,
  type RoomConfig,
  type RoomJoinMode,
  type RoomTablePhase,
  type RoomBalanceSummary,
  type SessionEnvelope,
  type SessionRole
} from "@potluck/contracts";

import { type EmailAdapter } from "./email.js";
import { appError } from "./errors.js";
import { createSignedToken, verifySignedToken } from "./security.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const OTP_REQUEST_LIMIT = 5;
const OTP_VERIFY_LIMIT = 5;
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;

type Clock = () => Date;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type OtpChallenge = {
  challengeId: string;
  email: string;
  code: string;
  expiresAt: Date;
  lastSentAt: Date;
  usedAt?: Date;
  verifyAttempts: number;
};

type AuditEvent = {
  eventId: string;
  type: string;
  occurredAt: string;
  roomId?: string;
  actorId?: string;
  detail: string;
};

type ParticipantRecord = {
  participantId: string;
  sessionId: string;
  nickname: string;
  mode: RoomJoinMode;
  joinedAt: Date;
  isConnected: boolean;
};

type QueueEntryRecord = {
  entryId: string;
  participantId: string;
  nickname: string;
  joinedAt: Date;
};

type SeatRecord = {
  seatIndex: number;
  status: "EMPTY" | "RESERVED" | "OCCUPIED" | "LOCKED_DURING_HAND";
  participantId?: string;
  reservedUntil?: Date;
  stack?: number;
};

type LedgerEntryRecord = {
  entryId: string;
  roomId: string;
  participantId: string;
  seatIndex?: number;
  type: "BUY_IN" | "REBUY" | "TOP_UP" | "COMPENSATING_ADJUSTMENT";
  delta: number;
  balanceAfter: number;
  referenceId: string;
  idempotencyKey?: string;
  createdAt: Date;
};

type BuyInResponse = ReturnType<typeof buyInResponseSchema.parse>;
type RebuyResponse = ReturnType<typeof rebuyResponseSchema.parse>;
type TopUpResponse = ReturnType<typeof topUpResponseSchema.parse>;
type ChipOperationResponse = BuyInResponse | RebuyResponse | TopUpResponse;
type ChipOperationType = Exclude<LedgerEntryRecord["type"], "COMPENSATING_ADJUSTMENT">;

type IdempotentLedgerOperation = {
  fingerprint: string;
  response: ChipOperationResponse;
};

type RoomRecord = {
  roomId: string;
  code: string;
  status: "CREATED" | "OPEN" | "PAUSED" | "CLOSED";
  tablePhase: RoomTablePhase;
  adminId: string;
  config: RoomConfig;
  createdAt: Date;
  joinCodeExpiresAt: Date;
  closesAt: Date;
  participants: Map<string, ParticipantRecord>;
  waitingList: QueueEntryRecord[];
  seats: SeatRecord[];
  ledgerEntries: LedgerEntryRecord[];
  processedLedgerOperations: Map<string, IdempotentLedgerOperation>;
};

type SessionRecord = {
  sessionId: string;
  tokenId: string;
  refreshTokenId: string;
  role: SessionRole;
  actor: AuthActor;
  issuedAt: Date;
  expiresAt: Date;
  refreshExpiresAt: Date;
  revokedAt?: Date;
};

type AdminProfileRecord = {
  adminId: string;
  email: string;
};

type TokenEnv = {
  SESSION_SIGNING_SECRET: string;
  GUEST_SESSION_SIGNING_SECRET: string;
};

type RequestOtpOptions = {
  email: string;
  ip: string;
  emailAdapter: EmailAdapter;
};

type AuthContext = {
  session: SessionEnvelope;
  actor: AuthActor;
};

type IssueSessionResult = AuthContext & {
  accessToken: string;
  refreshToken: string;
};

type GuestSessionResult = IssueSessionResult & {
  actor: Extract<AuthActor, { role: "GUEST" }>;
  lobbySnapshot: LobbySnapshot;
};

type CreateAppStateOptions = {
  clock?: Clock;
  onLedgerEntryCommitted?: (entry: LedgerEntryRecord) => void;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeRoomCode = (code: string) => code.trim().toUpperCase();
const normalizeNickname = (nickname: string) => nickname.trim().replace(/\s+/g, " ");
const toIso = (value: Date) => value.toISOString();

function secondsBetween(now: Date, future: Date) {
  return Math.max(0, Math.ceil((future.getTime() - now.getTime()) / 1000));
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return email;
  }

  const visibleLocal =
    localPart.length <= 2
      ? `${localPart[0] ?? "*"}*`
      : `${localPart.slice(0, 2)}***`;

  return `${visibleLocal}@${domain}`;
}

function createSeatMap(maxSeats: number): SeatRecord[] {
  return Array.from({ length: maxSeats }, (_, seatIndex) => ({
    seatIndex,
    status: "EMPTY"
  }));
}

export function createAppState(options: CreateAppStateOptions = {}) {
  const clock = options.clock ?? (() => new Date());
  const adminProfiles = new Map<string, AdminProfileRecord>();
  const otpChallenges = new Map<string, OtpChallenge>();
  const otpChallengeByEmail = new Map<string, string>();
  const rateLimits = new Map<string, RateLimitBucket>();
  const sessions = new Map<string, SessionRecord>();
  const roomsByCode = new Map<string, RoomRecord>();
  const roomsById = new Map<string, RoomRecord>();
  const auditEvents: AuditEvent[] = [];

  function addAuditEvent(event: Omit<AuditEvent, "eventId" | "occurredAt">) {
    auditEvents.push({ eventId: randomUUID(), occurredAt: toIso(clock()), ...event });
  }

  function consumeRateLimit(key: string, limit: number, windowMs: number) {
    const now = clock().getTime();
    const existing = rateLimits.get(key);

    if (!existing || existing.resetAt <= now) {
      rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (existing.count >= limit) {
      throw appError({
        code: "ERR_RATE_LIMITED",
        message: "Too many attempts. Please wait before trying again.",
        statusCode: 429,
        retryable: true,
        details: {
          retryAfterSeconds: String(Math.max(1, Math.ceil((existing.resetAt - now) / 1000)))
        }
      });
    }

    existing.count += 1;
  }

  function generateUniqueRoomCode() {
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      let code = "";

      for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
        code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
      }

      if (!roomsByCode.has(code)) {
        return code;
      }
    }

    throw appError({
      code: "ERR_INTERNAL",
      message: "We could not generate a unique room code.",
      statusCode: 500,
      retryable: true
    });
  }

  function getOrCreateAdminProfile(email: string) {
    const existing = adminProfiles.get(email);

    if (existing) {
      return existing;
    }

    const created = { adminId: `admin_${randomUUID()}`, email };
    adminProfiles.set(email, created);
    return created;
  }

  function createSession(actor: AuthActor, env: TokenEnv): IssueSessionResult {
    const now = clock();
    const expiresAt = new Date(now.getTime() + ACCESS_TTL_MS);
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS);
    const sessionId = `session_${randomUUID()}`;
    const tokenId = randomUUID();
    const refreshTokenId = randomUUID();

    sessions.set(sessionId, {
      sessionId,
      tokenId,
      refreshTokenId,
      role: actor.role,
      actor,
      issuedAt: now,
      expiresAt,
      refreshExpiresAt
    });

    const secret =
      actor.role === "ADMIN"
        ? env.SESSION_SIGNING_SECRET
        : env.GUEST_SESSION_SIGNING_SECRET;

    return {
      session: {
        sessionId,
        role: actor.role,
        issuedAt: toIso(now),
        expiresAt: toIso(expiresAt),
        refreshExpiresAt: toIso(refreshExpiresAt)
      },
      actor,
      accessToken: createSignedToken({
        sessionId,
        tokenId,
        role: actor.role,
        kind: "access",
        issuedAt: now,
        expiresAt,
        secret
      }),
      refreshToken: createSignedToken({
        sessionId,
        tokenId: refreshTokenId,
        role: actor.role,
        kind: "refresh",
        issuedAt: now,
        expiresAt: refreshExpiresAt,
        secret
      })
    };
  }

  function getSessionRecordFromToken(
    token: string | undefined,
    env: TokenEnv,
    kind: "access" | "refresh"
  ) {
    if (!token) {
      return null;
    }

    const payload = verifySignedToken(
      token,
      env.SESSION_SIGNING_SECRET,
      env.GUEST_SESSION_SIGNING_SECRET
    );

    if (!payload || payload.kind !== kind) {
      return null;
    }

    const session = sessions.get(payload.sessionId);
    const now = clock().getTime();

    if (!session || session.revokedAt) {
      return null;
    }

    const expiryMs =
      kind === "access" ? session.expiresAt.getTime() : session.refreshExpiresAt.getTime();
    const tokenId = kind === "access" ? session.tokenId : session.refreshTokenId;

    if (payload.exp * 1000 <= now || expiryMs <= now || payload.tokenId !== tokenId) {
      return null;
    }

    return session;
  }

  function rotateSession(session: SessionRecord, env: TokenEnv): IssueSessionResult {
    const now = clock();
    const expiresAt = new Date(now.getTime() + ACCESS_TTL_MS);
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS);
    const tokenId = randomUUID();
    const refreshTokenId = randomUUID();

    session.tokenId = tokenId;
    session.refreshTokenId = refreshTokenId;
    session.issuedAt = now;
    session.expiresAt = expiresAt;
    session.refreshExpiresAt = refreshExpiresAt;

    const secret =
      session.role === "ADMIN"
        ? env.SESSION_SIGNING_SECRET
        : env.GUEST_SESSION_SIGNING_SECRET;

    return {
      session: {
        sessionId: session.sessionId,
        role: session.role,
        issuedAt: toIso(now),
        expiresAt: toIso(expiresAt),
        refreshExpiresAt: toIso(refreshExpiresAt)
      },
      actor: session.actor,
      accessToken: createSignedToken({
        sessionId: session.sessionId,
        tokenId,
        role: session.role,
        kind: "access",
        issuedAt: now,
        expiresAt,
        secret
      }),
      refreshToken: createSignedToken({
        sessionId: session.sessionId,
        tokenId: refreshTokenId,
        role: session.role,
        kind: "refresh",
        issuedAt: now,
        expiresAt: refreshExpiresAt,
        secret
      })
    };
  }

  function removeParticipantFromRoom(room: RoomRecord, participantId: string) {
    room.waitingList = room.waitingList.filter((entry) => entry.participantId !== participantId);

    for (const seat of room.seats) {
      if (seat.participantId === participantId) {
        seat.status = "EMPTY";
        seat.participantId = undefined;
        seat.reservedUntil = undefined;
        seat.stack = undefined;
      }
    }

    room.participants.delete(participantId);
  }

  function closeRoomIfExpired(room: RoomRecord) {
    if (room.status !== "CLOSED" && room.closesAt.getTime() <= clock().getTime()) {
      room.status = "CLOSED";
    }
  }

  function releaseExpiredReservations(room: RoomRecord) {
    const nowMs = clock().getTime();

    for (const seat of room.seats) {
      if (
        seat.status === "RESERVED" &&
        seat.reservedUntil &&
        seat.reservedUntil.getTime() <= nowMs
      ) {
        seat.status = "EMPTY";
        seat.reservedUntil = undefined;
        seat.participantId = undefined;
      }
    }
  }

  function pruneExpiredParticipants(room: RoomRecord) {
    const nowMs = clock().getTime();

    for (const [participantId, participant] of room.participants.entries()) {
      const session = sessions.get(participant.sessionId);

      if (
        !session ||
        session.revokedAt ||
        session.refreshExpiresAt.getTime() <= nowMs
      ) {
        removeParticipantFromRoom(room, participantId);
      }
    }
  }

  function cleanupRoom(room: RoomRecord) {
    closeRoomIfExpired(room);
    releaseExpiredReservations(room);
    pruneExpiredParticipants(room);
  }

  function getRoomRecordByCode(code: string) {
    const room = roomsByCode.get(normalizeRoomCode(code));

    if (!room) {
      throw appError({
        code: "ERR_ROOM_NOT_FOUND",
        message: "That room code is invalid or has expired.",
        statusCode: 404,
        retryable: false
      });
    }

    cleanupRoom(room);

    if (room.joinCodeExpiresAt.getTime() <= clock().getTime()) {
      throw appError({
        code: "ERR_ROOM_NOT_FOUND",
        message: "That room code is invalid or has expired.",
        statusCode: 404,
        retryable: false
      });
    }

    return room;
  }

  function getRoomRecordById(roomId: string) {
    const room = roomsById.get(roomId);

    if (!room) {
      throw appError({
        code: "ERR_ROOM_NOT_FOUND",
        message: "That room no longer exists.",
        statusCode: 404,
        retryable: false
      });
    }

    cleanupRoom(room);
    return room;
  }

  function toRoomSummary(room: RoomRecord) {
    return roomPublicSummarySchema.parse({
      roomId: room.roomId,
      code: room.code,
      tableName: room.config.tableName,
      status: room.status,
      maxSeats: room.config.maxSeats,
      openSeatCount: room.seats.filter((seat) => seat.status === "EMPTY").length,
      reservedSeatCount: room.seats.filter((seat) => seat.status === "RESERVED").length,
      occupiedSeatCount: room.seats.filter((seat) => seat.status === "OCCUPIED").length,
      participantCount: room.participants.size,
      queuedCount: room.waitingList.length,
      spectatorsAllowed: room.config.spectatorsAllowed,
      waitingListEnabled: room.config.waitingListEnabled,
      joinCodeExpiresAt: toIso(room.joinCodeExpiresAt),
      createdAt: toIso(room.createdAt),
      closesAt: toIso(room.closesAt)
    });
  }

  function toBuyInQuote(room: RoomRecord) {
    const usesBigBlindMultiple = room.config.buyInMode === "BB_MULTIPLE";
    const minChips = usesBigBlindMultiple
      ? room.config.minBuyIn * room.config.bigBlind
      : room.config.minBuyIn;
    const maxChips = usesBigBlindMultiple
      ? room.config.maxBuyIn * room.config.bigBlind
      : room.config.maxBuyIn;

    return buyInQuoteResponseSchema.parse({
      roomId: room.roomId,
      mode: room.config.buyInMode,
      minUnits: room.config.minBuyIn,
      maxUnits: room.config.maxBuyIn,
      minChips,
      maxChips,
      smallBlind: room.config.smallBlind,
      bigBlind: room.config.bigBlind,
      ante: room.config.ante,
      displayMin: usesBigBlindMultiple
        ? `${room.config.minBuyIn} BB = ${minChips.toLocaleString()} chips`
        : `${minChips.toLocaleString()} chips`,
      displayMax: usesBigBlindMultiple
        ? `${room.config.maxBuyIn} BB = ${maxChips.toLocaleString()} chips`
        : `${maxChips.toLocaleString()} chips`
    });
  }

  function getChipRange(room: RoomRecord) {
    const quote = toBuyInQuote(room);

    return {
      minChips: quote.minChips,
      maxChips: quote.maxChips
    };
  }

  function getLedgerEntriesForParticipant(room: RoomRecord, participantId: string) {
    return room.ledgerEntries.filter((entry) => entry.participantId === participantId);
  }

  function getCurrentLedgerBalance(room: RoomRecord, participantId: string) {
    return getLedgerEntriesForParticipant(room, participantId).reduce(
      (total, entry) => total + entry.delta,
      0
    );
  }

  function toLedgerEntry(entry: LedgerEntryRecord): LedgerEntry {
    return {
      entryId: entry.entryId,
      roomId: entry.roomId,
      participantId: entry.participantId,
      seatIndex: entry.seatIndex,
      type: entry.type,
      delta: entry.delta,
      balanceAfter: entry.balanceAfter,
      referenceId: entry.referenceId,
      idempotencyKey: entry.idempotencyKey,
      createdAt: toIso(entry.createdAt)
    };
  }

  function toRoomBalanceSummary(room: RoomRecord, participantId: string): RoomBalanceSummary {
    const ledgerEntries = getLedgerEntriesForParticipant(room, participantId);
    const seat = getParticipantSeat(room, participantId);

    let buyInCommitted = 0;
    let rebuyCommitted = 0;
    let topUpCommitted = 0;
    let adjustmentTotal = 0;

    for (const entry of ledgerEntries) {
      if (entry.type === "BUY_IN") {
        buyInCommitted += entry.delta;
        continue;
      }

      if (entry.type === "REBUY") {
        rebuyCommitted += entry.delta;
        continue;
      }

      if (entry.type === "TOP_UP") {
        topUpCommitted += entry.delta;
        continue;
      }

      adjustmentTotal += entry.delta;
    }

    const totalCommitted = buyInCommitted + rebuyCommitted + topUpCommitted;
    const netBalance = totalCommitted + adjustmentTotal;

    return roomBalanceSummarySchema.parse({
      roomId: room.roomId,
      participantId,
      seatIndex: seat?.seatIndex,
      buyInCommitted,
      rebuyCommitted,
      topUpCommitted,
      adjustmentTotal,
      totalCommitted,
      netBalance,
      liveStack: seat?.stack ?? 0
    });
  }

  function getCachedLedgerOperation(
    room: RoomRecord,
    participantId: string,
    operation: ChipOperationType,
    idempotencyKey: string | undefined,
    fingerprint: string
  ) {
    if (!idempotencyKey) {
      return null;
    }

    const cacheKey = `${participantId}:${operation}:${idempotencyKey}`;
    const cached = room.processedLedgerOperations.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.fingerprint !== fingerprint) {
      throw appError({
        code: "ERR_ACTION_INVALID",
        message: "That idempotency key was already used for a different request.",
        statusCode: 409,
        retryable: false
      });
    }

    return cached.response;
  }

  function storeLedgerOperation(
    room: RoomRecord,
    participantId: string,
    operation: ChipOperationType,
    idempotencyKey: string | undefined,
    fingerprint: string,
    response: ChipOperationResponse
  ) {
    if (!idempotencyKey) {
      return;
    }

    const cacheKey = `${participantId}:${operation}:${idempotencyKey}`;
    room.processedLedgerOperations.set(cacheKey, {
      fingerprint,
      response
    });
  }

  function commitLedgerEntry(
    room: RoomRecord,
    payload: {
      participantId: string;
      seatIndex?: number;
      type: LedgerEntryRecord["type"];
      delta: number;
      idempotencyKey?: string;
    }
  ) {
    const balanceAfter = getCurrentLedgerBalance(room, payload.participantId) + payload.delta;

    if (balanceAfter < 0) {
      throw appError({
        code: "ERR_INTERNAL",
        message: "Ledger balance cannot go negative.",
        statusCode: 500,
        retryable: false
      });
    }

    const entry: LedgerEntryRecord = {
      entryId: `ledger_${randomUUID()}`,
      roomId: room.roomId,
      participantId: payload.participantId,
      seatIndex: payload.seatIndex,
      type: payload.type,
      delta: payload.delta,
      balanceAfter,
      referenceId: `op_${randomUUID()}`,
      idempotencyKey: payload.idempotencyKey,
      createdAt: clock()
    };

    try {
      options.onLedgerEntryCommitted?.(entry);
      room.ledgerEntries.push(entry);
      return entry;
    } catch {
      throw appError({
        code: "ERR_LEDGER_COMMIT_FAILED",
        message: "The room ledger could not be updated.",
        statusCode: 503,
        retryable: true
      });
    }
  }

  function assertBuyInAmountWithinRange(room: RoomRecord, amount: number) {
    const { minChips, maxChips } = getChipRange(room);

    if (amount < minChips) {
      throw appError({
        code: "ERR_MIN_BUYIN",
        message: `Buy-in must be at least ${minChips.toLocaleString()} chips.`,
        statusCode: 422,
        retryable: true
      });
    }

    if (amount > maxChips) {
      throw appError({
        code: "ERR_MAX_BUYIN",
        message: `Buy-in cannot exceed ${maxChips.toLocaleString()} chips.`,
        statusCode: 422,
        retryable: true
      });
    }
  }

  function assertRoomIsBetweenHands(room: RoomRecord) {
    if (room.tablePhase === "HAND_ACTIVE") {
      throw appError({
        code: "ERR_TOPUP_DURING_HAND",
        message: "Top-ups are only allowed between hands.",
        statusCode: 409,
        retryable: true
      });
    }
  }

  function getParticipantSeat(room: RoomRecord, participantId: string) {
    return room.seats.find((seat) => seat.participantId === participantId);
  }

  function getQueuePosition(room: RoomRecord, participantId: string) {
    const index = room.waitingList.findIndex((entry) => entry.participantId === participantId);
    return index >= 0 ? index + 1 : undefined;
  }

  function toSeatSnapshot(room: RoomRecord, seat: SeatRecord) {
    const participant = seat.participantId
      ? room.participants.get(seat.participantId)
      : undefined;

    return {
      seatIndex: seat.seatIndex,
      status: seat.status,
      participantId: seat.participantId,
      nickname: participant?.nickname,
      reservedUntil: seat.reservedUntil ? toIso(seat.reservedUntil) : undefined,
      stack: seat.stack
    };
  }

  function toLobbySnapshot(room: RoomRecord, heroParticipantId?: string) {
    cleanupRoom(room);

    const heroSeat = heroParticipantId
      ? getParticipantSeat(room, heroParticipantId)
      : undefined;
    const canJoinWaitingList =
      Boolean(heroParticipantId) &&
      room.config.waitingListEnabled &&
      room.seats.every((seat) => seat.status !== "EMPTY") &&
      !heroSeat &&
      !room.waitingList.some((entry) => entry.participantId === heroParticipantId);

    return lobbySnapshotSchema.parse({
      room: toRoomSummary(room),
      config: roomConfigSchema.parse(room.config),
      seats: room.seats.map((seat) => toSeatSnapshot(room, seat)),
      waitingList: room.waitingList.map((entry, index) =>
        queueEntrySchema.parse({
          entryId: entry.entryId,
          participantId: entry.participantId,
          nickname: entry.nickname,
          joinedAt: toIso(entry.joinedAt),
          position: index + 1
        })
      ),
      participants: [...room.participants.values()].map((participant) => {
        const seat = getParticipantSeat(room, participant.participantId);
        const queuePosition = getQueuePosition(room, participant.participantId);

        return {
          participantId: participant.participantId,
          nickname: participant.nickname,
          mode: participant.mode,
          state:
            participant.mode === "SPECTATOR"
              ? "SPECTATING"
              : seat?.status === "RESERVED"
                ? "RESERVED"
                : seat?.status === "OCCUPIED"
                  ? "SEATED"
                  : queuePosition
                    ? "QUEUED"
                    : "LOBBY",
          joinedAt: toIso(participant.joinedAt),
          isConnected: participant.isConnected,
          seatIndex: seat?.seatIndex,
          reservationExpiresAt: seat?.reservedUntil ? toIso(seat.reservedUntil) : undefined,
          queuePosition
        };
      }),
      buyInQuote: toBuyInQuote(room),
      heroParticipantId,
      heroSeatIndex: heroSeat?.seatIndex,
      canJoinWaitingList
    });
  }

  return {
    accessMaxAgeSeconds: Math.floor(ACCESS_TTL_MS / 1000),
    refreshMaxAgeSeconds: Math.floor(REFRESH_TTL_MS / 1000),
    async requestAdminOtp(options: RequestOtpOptions) {
      const now = clock();
      const email = normalizeEmail(options.email);

      consumeRateLimit(`otp-email:${email}`, OTP_REQUEST_LIMIT, OTP_REQUEST_WINDOW_MS);
      consumeRateLimit(`otp-ip:${options.ip}`, OTP_REQUEST_LIMIT, OTP_REQUEST_WINDOW_MS);

      const previousChallengeId = otpChallengeByEmail.get(email);
      const previousChallenge =
        previousChallengeId ? otpChallenges.get(previousChallengeId) : undefined;

      if (
        previousChallenge &&
        !previousChallenge.usedAt &&
        previousChallenge.expiresAt.getTime() > now.getTime()
      ) {
        const cooldownEndsAt = new Date(
          previousChallenge.lastSentAt.getTime() + OTP_COOLDOWN_MS
        );

        if (cooldownEndsAt.getTime() > now.getTime()) {
          throw appError({
            code: "ERR_RATE_LIMITED",
            message: "Please wait before requesting another code.",
            statusCode: 429,
            retryable: true,
            details: {
              retryAfterSeconds: String(secondsBetween(now, cooldownEndsAt))
            }
          });
        }
      }

      const challengeId = `challenge_${randomUUID()}`;
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

      otpChallenges.set(challengeId, {
        challengeId,
        email,
        code,
        expiresAt,
        lastSentAt: now,
        verifyAttempts: 0
      });
      otpChallengeByEmail.set(email, challengeId);

      await options.emailAdapter.sendAdminOtp({
        email,
        code,
        challengeId,
        expiresAt: toIso(expiresAt)
      });

      addAuditEvent({ type: "AUTH_ADMIN_OTP_REQUESTED", detail: `OTP requested for ${email}` });

      return adminOtpRequestResponseSchema.parse({
        challengeId,
        cooldownSeconds: Math.floor(OTP_COOLDOWN_MS / 1000),
        expiresAt: toIso(expiresAt),
        delivery: { channel: "email", recipientHint: maskEmail(email) }
      });
    },
    verifyAdminOtp(challengeId: string, code: string, ip: string, env: TokenEnv) {
      consumeRateLimit(`verify-ip:${ip}`, OTP_VERIFY_LIMIT, OTP_REQUEST_WINDOW_MS);

      const challenge = otpChallenges.get(challengeId);
      const now = clock();

      if (!challenge || challenge.usedAt || challenge.expiresAt.getTime() <= now.getTime()) {
        throw appError({
          code: "ERR_OTP_EXPIRED",
          message: "That verification code has expired.",
          statusCode: 401,
          retryable: true
        });
      }

      if (challenge.verifyAttempts >= OTP_VERIFY_LIMIT) {
        throw appError({
          code: "ERR_RATE_LIMITED",
          message: "Too many incorrect attempts for this code.",
          statusCode: 429,
          retryable: true
        });
      }

      if (challenge.code !== code) {
        challenge.verifyAttempts += 1;
        addAuditEvent({
          type: "AUTH_ADMIN_OTP_REJECTED",
          detail: `Incorrect code for ${challenge.email}`
        });

        throw appError({
          code: "ERR_OTP_INVALID",
          message: "The verification code is incorrect.",
          statusCode: 401,
          retryable: true
        });
      }

      challenge.usedAt = now;

      const adminProfile = getOrCreateAdminProfile(challenge.email);
      const issuedSession = createSession(
        { role: "ADMIN", adminId: adminProfile.adminId, email: adminProfile.email },
        env
      );

      addAuditEvent({
        type: "AUTH_ADMIN_VERIFIED",
        actorId: adminProfile.adminId,
        detail: `Admin session created for ${adminProfile.email}`
      });

      return issuedSession;
    },
    createRoom(actor: Extract<AuthActor, { role: "ADMIN" }>, input: RoomConfig) {
      const config = roomConfigSchema.parse(input);

      for (const room of roomsById.values()) {
        cleanupRoom(room);

        if (room.adminId === actor.adminId && room.status !== "CLOSED") {
          throw appError({
            code: "ERR_ACTIVE_ROOM_EXISTS",
            message: "This admin already has an active room.",
            statusCode: 409,
            retryable: false
          });
        }
      }

      const now = clock();
      const room: RoomRecord = {
        roomId: `room_${randomUUID()}`,
        code: generateUniqueRoomCode(),
        status: "OPEN",
        tablePhase: "BETWEEN_HANDS",
        adminId: actor.adminId,
        config,
        createdAt: now,
        joinCodeExpiresAt: new Date(now.getTime() + config.joinCodeExpiryMinutes * 60 * 1000),
        closesAt: new Date(now.getTime() + config.roomMaxDurationMinutes * 60 * 1000),
        participants: new Map(),
        waitingList: [],
        seats: createSeatMap(config.maxSeats),
        ledgerEntries: [],
        processedLedgerOperations: new Map()
      };

      roomsByCode.set(room.code, room);
      roomsById.set(room.roomId, room);

      addAuditEvent({
        type: "ROOM_CREATED",
        roomId: room.roomId,
        actorId: actor.adminId,
        detail: `Room ${room.code} created`
      });

      return roomCreateResponseSchema.parse({
        room: toRoomSummary(room),
        lobbySnapshot: toLobbySnapshot(room)
      });
    },
    getRoomSummary(code: string) {
      return toRoomSummary(getRoomRecordByCode(code));
    },
    getLobbySnapshot(roomId: string, actor: AuthActor) {
      const room = getRoomRecordById(roomId);

      if (actor.role === "ADMIN") {
        if (room.adminId !== actor.adminId) {
          throw appError({
            code: "ERR_FORBIDDEN",
            message: "This admin cannot view that room.",
            statusCode: 403,
            retryable: false
          });
        }

        return toLobbySnapshot(room);
      }

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      return toLobbySnapshot(room, actor.guestId);
    },
    joinRoom(code: string, nickname: string, mode: RoomJoinMode, env: TokenEnv): GuestSessionResult {
      const normalizedNickname = normalizeNickname(nickname);
      const room = getRoomRecordByCode(code);

      if (room.status === "CLOSED") {
        throw appError({
          code: "ERR_ROOM_CLOSED",
          message: "This room is no longer accepting joins.",
          statusCode: 409,
          retryable: false
        });
      }

      if (mode === "SPECTATOR" && !room.config.spectatorsAllowed) {
        throw appError({
          code: "ERR_SPECTATOR_DISABLED",
          message: "Spectator access is disabled for this room.",
          statusCode: 403,
          retryable: false
        });
      }

      for (const participant of room.participants.values()) {
        if (participant.nickname.toLowerCase() === normalizedNickname.toLowerCase()) {
          throw appError({
            code: "ERR_JOIN_NAME_CONFLICT",
            message: "That nickname is already active in this room.",
            statusCode: 409,
            retryable: true
          });
        }
      }

      if (
        mode === "PLAYER" &&
        !room.seats.some((seat) => seat.status === "EMPTY") &&
        !room.config.waitingListEnabled
      ) {
        throw appError({
          code: "ERR_ROOM_FULL",
          message: "This room is full and the waiting list is disabled.",
          statusCode: 409,
          retryable: true
        });
      }

      const actor: Extract<AuthActor, { role: "GUEST" }> = {
        role: "GUEST",
        guestId: `guest_${randomUUID()}`,
        nickname: normalizedNickname,
        mode,
        roomId: room.roomId,
        roomCode: room.code
      };
      const issuedSession = createSession(actor, env);

      room.participants.set(actor.guestId, {
        participantId: actor.guestId,
        sessionId: issuedSession.session.sessionId,
        nickname: normalizedNickname,
        mode,
        joinedAt: clock(),
        isConnected: true
      });

      addAuditEvent({
        type: "ROOM_GUEST_JOINED",
        roomId: room.roomId,
        actorId: actor.guestId,
        detail: `${normalizedNickname} joined as ${mode}`
      });

      return {
        session: issuedSession.session,
        actor,
        lobbySnapshot: toLobbySnapshot(room, actor.guestId),
        accessToken: issuedSession.accessToken,
        refreshToken: issuedSession.refreshToken
      };
    },
    getBuyInQuote(roomId: string, actor: AuthActor) {
      const room = getRoomRecordById(roomId);

      if (actor.role === "ADMIN" && room.adminId !== actor.adminId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This admin cannot view that room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.role === "GUEST" && actor.roomId !== roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      return toBuyInQuote(room);
    },
    reserveSeat(roomId: string, seatIndex: number, actor: Extract<AuthActor, { role: "GUEST" }>) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.mode === "SPECTATOR") {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "Spectators cannot reserve seats.",
          statusCode: 403,
          retryable: false
        });
      }

      if (getParticipantSeat(room, actor.guestId)) {
        throw appError({
          code: "ERR_ALREADY_SEATED",
          message: "This player already holds a seat reservation.",
          statusCode: 409,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);
      const seat = room.seats.at(seatIndex);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      if (!seat) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "That seat does not exist.",
          statusCode: 422,
          retryable: false
        });
      }

      if (seat.status !== "EMPTY") {
        throw appError({
          code: "ERR_SEAT_TAKEN",
          message: "That seat is no longer open.",
          statusCode: 409,
          retryable: true
        });
      }

      seat.status = "RESERVED";
      seat.participantId = actor.guestId;
      seat.reservedUntil = new Date(
        clock().getTime() + room.config.seatReservationTimeoutSeconds * 1000
      );
      room.waitingList = room.waitingList.filter((entry) => entry.participantId !== actor.guestId);

      addAuditEvent({
        type: "ROOM_SEAT_RESERVED",
        roomId,
        actorId: actor.guestId,
        detail: `${participant.nickname} reserved seat ${seatIndex}`
      });

      return seatReservationResponseSchema.parse({
        reservedSeatIndex: seatIndex,
        reservedUntil: toIso(seat.reservedUntil),
        buyInQuote: toBuyInQuote(room),
        lobbySnapshot: toLobbySnapshot(room, actor.guestId)
      });
    },
    joinWaitingList(roomId: string, actor: Extract<AuthActor, { role: "GUEST" }>) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.mode === "SPECTATOR") {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "Spectators cannot join the waiting list.",
          statusCode: 403,
          retryable: false
        });
      }

      if (!room.config.waitingListEnabled) {
        throw appError({
          code: "ERR_ROOM_FULL",
          message: "This room does not allow waiting-list joins.",
          statusCode: 409,
          retryable: false
        });
      }

      if (room.seats.some((seat) => seat.status === "EMPTY")) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "Open seats are still available, so queueing is not needed.",
          statusCode: 409,
          retryable: true
        });
      }

      if (getParticipantSeat(room, actor.guestId)) {
        throw appError({
          code: "ERR_ALREADY_SEATED",
          message: "This player already holds a seat reservation.",
          statusCode: 409,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);
      const existing = room.waitingList.find((entry) => entry.participantId === actor.guestId);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      if (existing) {
        throw appError({
          code: "ERR_ALREADY_QUEUED",
          message: "This player is already on the waiting list.",
          statusCode: 409,
          retryable: false
        });
      }

      const queueEntry: QueueEntryRecord = {
        entryId: `queue_${randomUUID()}`,
        participantId: actor.guestId,
        nickname: participant.nickname,
        joinedAt: clock()
      };

      room.waitingList.push(queueEntry);

      addAuditEvent({
        type: "ROOM_WAITING_LIST_JOINED",
        roomId,
        actorId: actor.guestId,
        detail: `${participant.nickname} joined the waiting list`
      });

      return {
        queueEntry: queueEntrySchema.parse({
          entryId: queueEntry.entryId,
          participantId: queueEntry.participantId,
          nickname: queueEntry.nickname,
          joinedAt: toIso(queueEntry.joinedAt),
          position: room.waitingList.length
        }),
        lobbySnapshot: toLobbySnapshot(room, actor.guestId)
      };
    },
    buyIn(
      roomId: string,
      seatIndex: number,
      amount: number,
      actor: Extract<AuthActor, { role: "GUEST" }>,
      idempotencyKey?: string
    ) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.mode === "SPECTATOR") {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "Spectators cannot commit a buy-in.",
          statusCode: 403,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);
      const seat = room.seats.at(seatIndex);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      if (!seat) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "That seat does not exist.",
          statusCode: 422,
          retryable: false
        });
      }

      const fingerprint = JSON.stringify({ seatIndex, amount });
      const cached = getCachedLedgerOperation(
        room,
        actor.guestId,
        "BUY_IN",
        idempotencyKey,
        fingerprint
      );

      if (cached) {
        return buyInResponseSchema.parse(cached);
      }

      if (seat.status !== "RESERVED" || seat.participantId !== actor.guestId) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "A matching seat reservation is required before buying in.",
          statusCode: 422,
          retryable: false
        });
      }

      assertBuyInAmountWithinRange(room, amount);

      const ledgerEntry = commitLedgerEntry(room, {
        participantId: actor.guestId,
        seatIndex,
        type: "BUY_IN",
        delta: amount,
        idempotencyKey
      });

      seat.status = "OCCUPIED";
      seat.reservedUntil = undefined;
      seat.stack = amount;

      addAuditEvent({
        type: "BUYIN_COMMITTED",
        roomId,
        actorId: actor.guestId,
        detail: `${participant.nickname} committed ${amount.toLocaleString()} chips at seat ${
          seatIndex + 1
        }`
      });

      const lobbySnapshot = toLobbySnapshot(room, actor.guestId);
      const response = buyInResponseSchema.parse({
        operation: "BUY_IN",
        tablePhase: room.tablePhase,
        seat: toSeatSnapshot(room, seat),
        ledgerEntry: toLedgerEntry(ledgerEntry),
        balance: toRoomBalanceSummary(room, actor.guestId),
        lobbySnapshot
      });

      storeLedgerOperation(
        room,
        actor.guestId,
        "BUY_IN",
        idempotencyKey,
        fingerprint,
        response
      );

      return response;
    },
    rebuy(
      roomId: string,
      amount: number,
      actor: Extract<AuthActor, { role: "GUEST" }>,
      idempotencyKey?: string
    ) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.mode === "SPECTATOR") {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "Spectators cannot rebuy.",
          statusCode: 403,
          retryable: false
        });
      }

      if (!room.config.rebuyEnabled) {
        throw appError({
          code: "ERR_REBUY_DISABLED",
          message: "Rebuys are disabled for this room.",
          statusCode: 409,
          retryable: false
        });
      }

      const participant = room.participants.get(actor.guestId);
      const seat = getParticipantSeat(room, actor.guestId);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      if (!seat || seat.status !== "OCCUPIED") {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "You need an occupied seat to rebuy.",
          statusCode: 422,
          retryable: false
        });
      }

      if ((seat.stack ?? 0) > 0) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "Rebuy is only available after your current stack reaches zero.",
          statusCode: 422,
          retryable: true
        });
      }

      const fingerprint = JSON.stringify({ amount });
      const cached = getCachedLedgerOperation(
        room,
        actor.guestId,
        "REBUY",
        idempotencyKey,
        fingerprint
      );

      if (cached) {
        return rebuyResponseSchema.parse(cached);
      }

      assertBuyInAmountWithinRange(room, amount);

      const ledgerEntry = commitLedgerEntry(room, {
        participantId: actor.guestId,
        seatIndex: seat.seatIndex,
        type: "REBUY",
        delta: amount,
        idempotencyKey
      });

      seat.stack = amount;

      addAuditEvent({
        type: "BUYIN_COMMITTED",
        roomId,
        actorId: actor.guestId,
        detail: `${participant.nickname} rebought ${amount.toLocaleString()} chips at seat ${
          seat.seatIndex + 1
        }`
      });

      const lobbySnapshot = toLobbySnapshot(room, actor.guestId);
      const response = rebuyResponseSchema.parse({
        operation: "REBUY",
        tablePhase: room.tablePhase,
        seat: toSeatSnapshot(room, seat),
        ledgerEntry: toLedgerEntry(ledgerEntry),
        balance: toRoomBalanceSummary(room, actor.guestId),
        lobbySnapshot
      });

      storeLedgerOperation(
        room,
        actor.guestId,
        "REBUY",
        idempotencyKey,
        fingerprint,
        response
      );

      return response;
    },
    topUp(
      roomId: string,
      amount: number,
      actor: Extract<AuthActor, { role: "GUEST" }>,
      idempotencyKey?: string
    ) {
      const room = getRoomRecordById(roomId);

      if (actor.roomId !== room.roomId) {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "This guest session is scoped to a different room.",
          statusCode: 403,
          retryable: false
        });
      }

      if (actor.mode === "SPECTATOR") {
        throw appError({
          code: "ERR_FORBIDDEN",
          message: "Spectators cannot top up a seat.",
          statusCode: 403,
          retryable: false
        });
      }

      if (!room.config.topUpEnabled) {
        throw appError({
          code: "ERR_TOPUP_DISABLED",
          message: "Top-ups are disabled for this room.",
          statusCode: 409,
          retryable: false
        });
      }

      assertRoomIsBetweenHands(room);

      const participant = room.participants.get(actor.guestId);
      const seat = getParticipantSeat(room, actor.guestId);

      if (!participant) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "An active room session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      if (!seat || seat.status !== "OCCUPIED") {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "You need an occupied seat to top up.",
          statusCode: 422,
          retryable: false
        });
      }

      if ((seat.stack ?? 0) <= 0) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "Use rebuy after your stack reaches zero.",
          statusCode: 422,
          retryable: true
        });
      }

      const { maxChips } = getChipRange(room);
      const nextStack = (seat.stack ?? 0) + amount;

      if (nextStack > maxChips) {
        throw appError({
          code: "ERR_MAX_BUYIN",
          message: `Top-up cannot take you above ${maxChips.toLocaleString()} chips.`,
          statusCode: 422,
          retryable: true
        });
      }

      const fingerprint = JSON.stringify({ amount });
      const cached = getCachedLedgerOperation(
        room,
        actor.guestId,
        "TOP_UP",
        idempotencyKey,
        fingerprint
      );

      if (cached) {
        return topUpResponseSchema.parse(cached);
      }

      const ledgerEntry = commitLedgerEntry(room, {
        participantId: actor.guestId,
        seatIndex: seat.seatIndex,
        type: "TOP_UP",
        delta: amount,
        idempotencyKey
      });

      seat.stack = nextStack;

      addAuditEvent({
        type: "BUYIN_COMMITTED",
        roomId,
        actorId: actor.guestId,
        detail: `${participant.nickname} topped up ${amount.toLocaleString()} chips at seat ${
          seat.seatIndex + 1
        }`
      });

      const lobbySnapshot = toLobbySnapshot(room, actor.guestId);
      const response = topUpResponseSchema.parse({
        operation: "TOP_UP",
        tablePhase: room.tablePhase,
        seat: toSeatSnapshot(room, seat),
        ledgerEntry: toLedgerEntry(ledgerEntry),
        balance: toRoomBalanceSummary(room, actor.guestId),
        lobbySnapshot
      });

      storeLedgerOperation(
        room,
        actor.guestId,
        "TOP_UP",
        idempotencyKey,
        fingerprint,
        response
      );

      return response;
    },
    getAuthContext(accessToken: string | undefined, env: TokenEnv): AuthContext | null {
      const session = getSessionRecordFromToken(accessToken, env, "access");

      if (!session) {
        return null;
      }

      return {
        session: {
          sessionId: session.sessionId,
          role: session.role,
          issuedAt: toIso(session.issuedAt),
          expiresAt: toIso(session.expiresAt),
          refreshExpiresAt: toIso(session.refreshExpiresAt)
        },
        actor: session.actor
      };
    },
    refreshSession(refreshToken: string | undefined, env: TokenEnv) {
      const session = getSessionRecordFromToken(refreshToken, env, "refresh");

      if (!session) {
        throw appError({
          code: "ERR_AUTH_REQUIRED",
          message: "A valid refresh session is required.",
          statusCode: 401,
          retryable: true
        });
      }

      addAuditEvent({
        type: "AUTH_SESSION_REFRESHED",
        actorId:
          session.actor.role === "ADMIN" ? session.actor.adminId : session.actor.guestId,
        roomId: session.actor.role === "GUEST" ? session.actor.roomId : undefined,
        detail: `Session refreshed for ${session.actor.role}`
      });

      return rotateSession(session, env);
    },
    logout(accessToken: string | undefined, refreshToken: string | undefined, env: TokenEnv) {
      const session =
        getSessionRecordFromToken(accessToken, env, "access") ??
        getSessionRecordFromToken(refreshToken, env, "refresh");

      if (!session) {
        return;
      }

      session.revokedAt = clock();

      if (session.actor.role === "GUEST") {
        const room = roomsById.get(session.actor.roomId);

        if (room) {
          cleanupRoom(room);
          removeParticipantFromRoom(room, session.actor.guestId);
        }
      }

      addAuditEvent({
        type: "AUTH_SESSION_LOGGED_OUT",
        actorId:
          session.actor.role === "ADMIN" ? session.actor.adminId : session.actor.guestId,
        roomId: session.actor.role === "GUEST" ? session.actor.roomId : undefined,
        detail: `Session logged out for ${session.actor.role}`
      });
    },
    getSessionTokens(result: IssueSessionResult) {
      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessMaxAgeSeconds: Math.floor(ACCESS_TTL_MS / 1000),
        refreshMaxAgeSeconds: Math.floor(REFRESH_TTL_MS / 1000)
      };
    },
    setRoomTablePhaseForTests(roomId: string, tablePhase: RoomTablePhase) {
      const room = getRoomRecordById(roomId);
      room.tablePhase = tablePhase;
    },
    setSeatStackForTests(roomId: string, participantId: string, stack: number) {
      const room = getRoomRecordById(roomId);
      const seat = getParticipantSeat(room, participantId);

      if (!seat) {
        throw appError({
          code: "ERR_ACTION_INVALID",
          message: "That participant does not currently hold a seat.",
          statusCode: 422,
          retryable: false
        });
      }

      seat.status = "OCCUPIED";
      seat.stack = stack;
      seat.reservedUntil = undefined;
    },
    applyCompensatingAdjustmentForTests(
      roomId: string,
      participantId: string,
      amount: number,
      idempotencyKey?: string
    ) {
      const room = getRoomRecordById(roomId);
      const seat = getParticipantSeat(room, participantId);
      const currentStack = seat?.stack ?? 0;
      const nextStack = Math.max(0, currentStack - amount);
      const ledgerEntry = commitLedgerEntry(room, {
        participantId,
        seatIndex: seat?.seatIndex,
        type: "COMPENSATING_ADJUSTMENT",
        delta: -Math.abs(amount),
        idempotencyKey
      });

      if (seat) {
        seat.stack = nextStack;
      }

      return {
        ledgerEntry: toLedgerEntry(ledgerEntry),
        balance: toRoomBalanceSummary(room, participantId)
      };
    },
    getRoomBalanceSummary(roomId: string, participantId: string) {
      const room = getRoomRecordById(roomId);
      return toRoomBalanceSummary(room, participantId);
    },
    getLedgerEntries(roomId: string, participantId?: string) {
      const room = getRoomRecordById(roomId);
      const entries = participantId
        ? getLedgerEntriesForParticipant(room, participantId)
        : room.ledgerEntries;

      return entries.map((entry) => toLedgerEntry(entry));
    },
    getAuditEvents() {
      return [...auditEvents];
    }
  };
}

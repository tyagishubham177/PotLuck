import { randomInt, randomUUID } from "node:crypto";

import {
  adminOtpRequestResponseSchema,
  roomPublicSummarySchema,
  type AuthActor,
  type LobbySnapshot,
  type RoomJoinMode,
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

type RoomRecord = {
  roomId: string;
  code: string;
  tableName: string;
  status: "OPEN" | "PAUSED" | "CLOSED";
  maxSeats: number;
  spectatorsAllowed: boolean;
  joinCodeExpiresAt: Date;
  createdAt: Date;
  participants: Map<string, ParticipantRecord>;
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeRoomCode(code: string) {
  return code.trim().toUpperCase();
}

function normalizeNickname(nickname: string) {
  return nickname.trim().replace(/\s+/g, " ");
}

function toIso(value: Date) {
  return value.toISOString();
}

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

function seedRooms(now: Date) {
  const createdAt = new Date(now.getTime() - 30 * 60 * 1000);

  const baseRooms = [
    {
      roomId: "room_demo_42",
      code: "DEMO42",
      tableName: "Phase One Demo Table",
      status: "OPEN" as const,
      maxSeats: 6,
      spectatorsAllowed: true,
      joinCodeExpiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      createdAt
    },
    {
      roomId: "room_finale",
      code: "FINALE",
      tableName: "Closed Table",
      status: "CLOSED" as const,
      maxSeats: 6,
      spectatorsAllowed: false,
      joinCodeExpiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      createdAt
    },
    {
      roomId: "room_sunset",
      code: "SUNSET",
      tableName: "Expired Code Table",
      status: "OPEN" as const,
      maxSeats: 9,
      spectatorsAllowed: true,
      joinCodeExpiresAt: new Date(now.getTime() - 5 * 60 * 1000),
      createdAt
    }
  ] satisfies Array<Omit<RoomRecord, "participants">>;

  return new Map(
    baseRooms.map((room) => [
      room.code,
      {
        ...room,
        participants: new Map<string, ParticipantRecord>()
      }
    ])
  );
}

export function createPhaseOneState(options: { clock?: Clock } = {}) {
  const clock = options.clock ?? (() => new Date());
  const adminProfiles = new Map<string, AdminProfileRecord>();
  const otpChallenges = new Map<string, OtpChallenge>();
  const otpChallengeByEmail = new Map<string, string>();
  const rateLimits = new Map<string, RateLimitBucket>();
  const sessions = new Map<string, SessionRecord>();
  const rooms = seedRooms(clock());
  const auditEvents: AuditEvent[] = [];

  function addAuditEvent(event: Omit<AuditEvent, "eventId" | "occurredAt">) {
    auditEvents.push({
      eventId: randomUUID(),
      occurredAt: toIso(clock()),
      ...event
    });
  }

  function consumeRateLimit(key: string, limit: number, windowMs: number) {
    const now = clock().getTime();
    const existing = rateLimits.get(key);

    if (!existing || existing.resetAt <= now) {
      rateLimits.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return;
    }

    if (existing.count >= limit) {
      throw appError({
        code: "ERR_RATE_LIMITED",
        message: "Too many attempts. Please wait before trying again.",
        statusCode: 429,
        retryable: true,
        details: {
          retryAfterSeconds: String(
            Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
          )
        }
      });
    }

    existing.count += 1;
  }

  function getRoomRecord(code: string) {
    const room = rooms.get(normalizeRoomCode(code));
    const now = clock();

    if (!room || room.joinCodeExpiresAt.getTime() <= now.getTime()) {
      throw appError({
        code: "ERR_ROOM_NOT_FOUND",
        message: "That room code is invalid or has expired.",
        statusCode: 404,
        retryable: false
      });
    }

    return room;
  }

  function pruneExpiredParticipants(room: RoomRecord) {
    const now = clock().getTime();

    for (const [participantId, participant] of room.participants.entries()) {
      const session = sessions.get(participant.sessionId);

      if (
        !session ||
        session.revokedAt ||
        session.refreshExpiresAt.getTime() <= now
      ) {
        room.participants.delete(participantId);
      }
    }
  }

  function toRoomSummary(room: RoomRecord) {
    pruneExpiredParticipants(room);

    return roomPublicSummarySchema.parse({
      roomId: room.roomId,
      code: room.code,
      tableName: room.tableName,
      status: room.status,
      maxSeats: room.maxSeats,
      openSeatCount: Math.max(0, room.maxSeats - room.participants.size),
      occupantCount: room.participants.size,
      spectatorsAllowed: room.spectatorsAllowed,
      joinCodeExpiresAt: toIso(room.joinCodeExpiresAt),
      createdAt: toIso(room.createdAt)
    });
  }

  function getOrCreateAdminProfile(email: string) {
    const existing = adminProfiles.get(email);

    if (existing) {
      return existing;
    }

    const created = {
      adminId: `admin_${randomUUID()}`,
      email
    };

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
    const tokenId =
      kind === "access" ? session.tokenId : session.refreshTokenId;

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

      addAuditEvent({
        type: "AUTH_ADMIN_OTP_REQUESTED",
        detail: `OTP requested for ${email}`
      });

      return adminOtpRequestResponseSchema.parse({
        challengeId,
        cooldownSeconds: Math.floor(OTP_COOLDOWN_MS / 1000),
        expiresAt: toIso(expiresAt),
        delivery: {
          channel: "email",
          recipientHint: maskEmail(email)
        }
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
        {
          role: "ADMIN",
          adminId: adminProfile.adminId,
          email: adminProfile.email
        },
        env
      );

      addAuditEvent({
        type: "AUTH_ADMIN_VERIFIED",
        actorId: adminProfile.adminId,
        detail: `Admin session created for ${adminProfile.email}`
      });

      return issuedSession;
    },
    getRoomSummary(code: string) {
      return toRoomSummary(getRoomRecord(code));
    },
    joinRoom(
      code: string,
      nickname: string,
      mode: RoomJoinMode,
      env: TokenEnv
    ): GuestSessionResult {
      const normalizedNickname = normalizeNickname(nickname);
      const room = getRoomRecord(code);

      if (room.status === "CLOSED") {
        throw appError({
          code: "ERR_ROOM_CLOSED",
          message: "This room is no longer accepting joins.",
          statusCode: 409,
          retryable: false
        });
      }

      if (mode === "SPECTATOR" && !room.spectatorsAllowed) {
        throw appError({
          code: "ERR_SPECTATOR_DISABLED",
          message: "Spectator access is disabled for this room.",
          statusCode: 403,
          retryable: false
        });
      }

      pruneExpiredParticipants(room);

      const normalizedLower = normalizedNickname.toLowerCase();

      for (const participant of room.participants.values()) {
        if (participant.nickname.toLowerCase() === normalizedLower) {
          throw appError({
            code: "ERR_JOIN_NAME_CONFLICT",
            message: "That nickname is already active in this room.",
            statusCode: 409,
            retryable: true
          });
        }
      }

      const actor: AuthActor = {
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

      const lobbySnapshot: LobbySnapshot = {
        room: toRoomSummary(room),
        participants: [...room.participants.values()].map((participant) => ({
          participantId: participant.participantId,
          nickname: participant.nickname,
          mode: participant.mode,
          state: participant.mode === "SPECTATOR" ? "SPECTATING" : "LOBBY",
          joinedAt: toIso(participant.joinedAt),
          isConnected: participant.isConnected
        })),
        heroParticipantId: actor.guestId
      };

      return {
        session: issuedSession.session,
        actor,
        lobbySnapshot,
        accessToken: issuedSession.accessToken,
        refreshToken: issuedSession.refreshToken
      };
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
          session.actor.role === "ADMIN"
            ? session.actor.adminId
            : session.actor.guestId,
        roomId: session.actor.role === "GUEST" ? session.actor.roomId : undefined,
        detail: `Session refreshed for ${session.actor.role}`
      });

      return rotateSession(session, env);
    },
    logout(
      accessToken: string | undefined,
      refreshToken: string | undefined,
      env: TokenEnv
    ) {
      const session =
        getSessionRecordFromToken(accessToken, env, "access") ??
        getSessionRecordFromToken(refreshToken, env, "refresh");

      if (!session) {
        return;
      }

      session.revokedAt = clock();

      if (session.actor.role === "GUEST") {
        rooms.get(normalizeRoomCode(session.actor.roomCode))?.participants.delete(
          session.actor.guestId
        );
      }

      addAuditEvent({
        type: "AUTH_SESSION_LOGGED_OUT",
        actorId:
          session.actor.role === "ADMIN"
            ? session.actor.adminId
            : session.actor.guestId,
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
    getAuditEvents() {
      return [...auditEvents];
    }
  };
}

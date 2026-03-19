import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket, type RawData } from "ws";

import type { RealtimeServerMessage } from "@potluck/contracts";

import { ACCESS_COOKIE_NAME } from "./cookies.js";
import { type EmailAdapter } from "./email.js";
import { buildServer } from "./server.js";
import { createAppState } from "./state.js";

const sentOtps: Array<{ email: string; code: string; challengeId: string }> = [];

const emailAdapter: EmailAdapter = {
  async sendAdminOtp(payload) {
    sentOtps.push({
      email: payload.email,
      code: payload.code,
      challengeId: payload.challengeId
    });
  }
};

const testEnv = {
  NODE_ENV: "test",
  PORT: "3001",
  APP_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/potluck?sslmode=require",
  DIRECT_DATABASE_URL: "postgresql://user:pass@localhost:5432/potluck?sslmode=require",
  SESSION_SIGNING_SECRET: "session-session-session-session-session",
  GUEST_SESSION_SIGNING_SECRET: "guest-guest-guest-guest-guest-guest",
  ADMIN_OTP_SIGNING_SECRET: "otp-otp-otp-otp-otp-otp-otp-otp-otp",
  COOKIE_SECRET: "cookie-cookie-cookie-cookie-cookie-cookie",
  RESEND_API_KEY: "re_dummy_resend_api_key",
  RESEND_FROM_EMAIL: "PotLuck Sandbox <onboarding@resend.dev>",
  REDIS_URL: "redis://default:dummy-password@localhost:6379",
  SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
  SENTRY_AUTH_TOKEN: "sntrys_dummy_auth_token",
  OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp-gateway-prod-us-central-0.grafana.net/otlp",
  OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic ZHVtbXktaW5zdGFuY2U6ZHVtbXktdG9rZW4="
} as const;

function getCookieHeader(setCookieHeaders: string[]) {
  return setCookieHeaders.map((entry) => entry.split(";")[0]).join("; ");
}

function getCookieValue(cookieHeader: string, name: string) {
  const token = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));

  return token ? decodeURIComponent(token.slice(name.length + 1)) : undefined;
}

async function createAdminCookieHeader(
  targetApp: ReturnType<typeof buildServer>,
  email = `host-${Date.now()}-${Math.random()}@example.com`
) {
  const requestOtpResponse = await targetApp.inject({
    method: "POST",
    url: "/api/auth/admin/request-otp",
    payload: { email },
    remoteAddress: "10.10.10.10"
  });
  const otpPayload = requestOtpResponse.json();
  const sentOtp = sentOtps.at(-1);

  const verifyResponse = await targetApp.inject({
    method: "POST",
    url: "/api/auth/admin/verify-otp",
    payload: {
      challengeId: otpPayload.challengeId,
      code: sentOtp?.code
    },
    remoteAddress: "10.10.10.10"
  });

  const sessionCookies = verifyResponse.headers["set-cookie"];
  return getCookieHeader(
    Array.isArray(sessionCookies) ? sessionCookies : [sessionCookies ?? ""]
  );
}

async function createRoom(
  targetApp: ReturnType<typeof buildServer>,
  adminCookieHeader: string
) {
  const response = await targetApp.inject({
    method: "POST",
    url: "/api/rooms",
    headers: { cookie: adminCookieHeader },
    payload: {
      tableName: "Realtime Table",
      maxSeats: 2,
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
    }
  });

  expect(response.statusCode).toBe(200);
  return response.json();
}

async function joinRoom(
  targetApp: ReturnType<typeof buildServer>,
  code: string,
  nickname: string
) {
  const response = await targetApp.inject({
    method: "POST",
    url: `/api/rooms/${code}/join`,
    payload: { nickname, mode: "PLAYER" }
  });
  const sessionCookies = response.headers["set-cookie"];

  return {
    response,
    cookieHeader: getCookieHeader(
      Array.isArray(sessionCookies) ? sessionCookies : [sessionCookies ?? ""]
    )
  };
}

async function openSocket(port: number, accessToken: string) {
  const socket = new WebSocket(
    `ws://127.0.0.1:${port}/ws?accessToken=${encodeURIComponent(accessToken)}`
  );

  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });

  return socket;
}

async function waitForMessage(
  socket: WebSocket,
  predicate: (message: RealtimeServerMessage) => boolean,
  timeoutMs = 5000
) {
  return await new Promise<RealtimeServerMessage>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", handleMessage);
      reject(new Error("Timed out waiting for realtime message."));
    }, timeoutMs);

    const handleMessage = (raw: RawData) => {
      const parsed = JSON.parse(raw.toString("utf8")) as RealtimeServerMessage;

      if (!predicate(parsed)) {
        return;
      }

      clearTimeout(timeout);
      socket.off("message", handleMessage);
      resolve(parsed);
    };

    socket.on("message", handleMessage);
  });
}

afterEach(() => {
  sentOtps.length = 0;
  vi.useRealTimers();
});

describe("phase 04 realtime room actor", () => {
  it("broadcasts disconnect and reconnect events over the websocket room subscription", async () => {
    const state = createAppState();
    const app = buildServer({
      env: testEnv,
      emailAdapter,
      state
    });

    await app.listen({ host: "127.0.0.1", port: 0 });

    try {
      const address = app.server.address() as AddressInfo;
      const adminCookieHeader = await createAdminCookieHeader(app);
      const room = await createRoom(app, adminCookieHeader);
      const guest = await joinRoom(app, room.room.code, "ReconnectHero");
      const adminAccessToken = getCookieValue(adminCookieHeader, ACCESS_COOKIE_NAME);
      const guestAccessToken = getCookieValue(guest.cookieHeader, ACCESS_COOKIE_NAME);

      expect(adminAccessToken).toBeTruthy();
      expect(guestAccessToken).toBeTruthy();

      const adminSocket = await openSocket(address.port, adminAccessToken ?? "");
      const guestSocket = await openSocket(address.port, guestAccessToken ?? "");

      try {
        adminSocket.send(
          JSON.stringify({ type: "ROOM_SUBSCRIBE", roomId: room.room.roomId })
        );
        guestSocket.send(
          JSON.stringify({ type: "ROOM_SUBSCRIBE", roomId: room.room.roomId })
        );

        await waitForMessage(adminSocket, (message) => message.type === "ROOM_SNAPSHOT");
        await waitForMessage(guestSocket, (message) => message.type === "ROOM_SNAPSHOT");

        guestSocket.close();

        const disconnectedEvent = await waitForMessage(
          adminSocket,
          (message) => message.type === "PLAYER_DISCONNECTED"
        );

        expect(disconnectedEvent.type).toBe("PLAYER_DISCONNECTED");
        if (disconnectedEvent.type !== "PLAYER_DISCONNECTED") {
          throw new Error("Expected a PLAYER_DISCONNECTED event.");
        }

        expect(disconnectedEvent.participantId).toBe(guest.response.json().actor.guestId);

        const guestSocketReconnect = await openSocket(address.port, guestAccessToken ?? "");

        try {
          guestSocketReconnect.send(
            JSON.stringify({ type: "ROOM_SUBSCRIBE", roomId: room.room.roomId })
          );

          const reconnectedEvent = await waitForMessage(
            adminSocket,
            (message) => message.type === "PLAYER_RECONNECTED"
          );

          expect(reconnectedEvent.type).toBe("PLAYER_RECONNECTED");
          if (reconnectedEvent.type !== "PLAYER_RECONNECTED") {
            throw new Error("Expected a PLAYER_RECONNECTED event.");
          }

          expect(reconnectedEvent.participantId).toBe(guest.response.json().actor.guestId);
        } finally {
          guestSocketReconnect.close();
        }
      } finally {
        adminSocket.close();
      }
    } finally {
      await app.close();
    }
  });

  it("replays idempotent actions and ignores stale timeout callbacks after turn advancement", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-19T12:00:00.000Z"));

    const state = createAppState({
      clock: () => new Date(Date.now())
    });

    const adminActor = {
      role: "ADMIN" as const,
      adminId: "admin_realtime_test",
      email: "host@example.com"
    };
    const room = state.createRoom(adminActor, {
      tableName: "Actor Table",
      maxSeats: 2,
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
    });

    const alpha = state.joinRoom(
      room.room.code,
      "Alpha",
      "PLAYER",
      testEnv
    );
    const bravo = state.joinRoom(
      room.room.code,
      "Bravo",
      "PLAYER",
      testEnv
    );

    state.reserveSeat(room.room.roomId, 0, alpha.actor);
    state.reserveSeat(room.room.roomId, 1, bravo.actor);
    state.buyIn(room.room.roomId, 0, 5000, alpha.actor, "alpha-buyin-1");
    state.buyIn(room.room.roomId, 1, 5000, bravo.actor, "bravo-buyin-1");

    const observedEvents: Array<{
      type: string;
      roomEventNo: number;
      actionType?: string;
    }> = [];
    const unsubscribe = state.subscribeToRoomEvents(room.room.roomId, (event) => {
      observedEvents.push(event);
    });

    try {
      state.playerReady(room.room.roomId, alpha.actor, 0);
      state.playerReady(room.room.roomId, bravo.actor, 1);

      const snapshot = state.getRoomRealtimeSnapshot(room.room.roomId, alpha.actor);
      expect(snapshot.activeHand?.actingSeatIndex).toBe(0);

      vi.advanceTimersByTime(1000);

      const firstAction = await state.submitAction(room.room.roomId, alpha.actor, {
        handId: snapshot.activeHand?.handId ?? "",
        seqExpectation: snapshot.activeHand?.handSeq ?? 0,
        idempotencyKey: "alpha-check-1",
        actionType: "CHECK"
      });
      const eventCountAfterFirstAction = observedEvents.length;
      const duplicateAction = await state.submitAction(room.room.roomId, alpha.actor, {
        handId: snapshot.activeHand?.handId ?? "",
        seqExpectation: snapshot.activeHand?.handSeq ?? 0,
        idempotencyKey: "alpha-check-1",
        actionType: "CHECK"
      });

      expect(firstAction.outcome).toBe("accepted");
      expect(duplicateAction).toEqual(firstAction);
      expect(observedEvents.length).toBe(eventCountAfterFirstAction);

      vi.advanceTimersByTime(14_000);

      expect(
        observedEvents.some(
          (event) =>
            event.type === "ACTION_ACCEPTED" && event.actionType === "TIMEOUT_FOLD"
        )
      ).toBe(false);

      vi.advanceTimersByTime(1_100);

      expect(
        observedEvents.some(
          (event) =>
            event.type === "ACTION_ACCEPTED" && event.actionType === "TIMEOUT_FOLD"
        )
      ).toBe(true);
      expect(
        observedEvents.every((event, index) =>
          index === 0 ? true : observedEvents[index - 1].roomEventNo <= event.roomEventNo
        )
      ).toBe(true);
    } finally {
      unsubscribe();
    }
  });
});

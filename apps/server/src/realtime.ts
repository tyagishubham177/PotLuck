import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { URL } from "node:url";

import type { FastifyInstance } from "fastify";
import { WebSocket, WebSocketServer, type RawData } from "ws";

import {
  realtimeClientMessageSchema,
  realtimeServerMessageSchema,
  type AuthActor,
  type ErrorCode,
  type RealtimeServerMessage
} from "@potluck/contracts";
import type { ServerEnv } from "@potluck/config/server";

import { getAccessTokenFromHeaders } from "./cookies.js";
import { AppError } from "./errors.js";
import { type createAppState } from "./state.js";

type RealtimeState = ReturnType<typeof createAppState>;

type ConnectionContext = {
  id: string;
  socket: WebSocket;
  actor: AuthActor;
  roomId?: string;
  unsubscribe?: () => void;
};

function sendMessage(socket: WebSocket, message: RealtimeServerMessage) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(realtimeServerMessageSchema.parse(message)));
}

function sendServerError(
  socket: WebSocket,
  errorCode: ErrorCode,
  message: string,
  roomId?: string,
  roomEventNo?: number
) {
  sendMessage(socket, {
    type: "SERVER_ERROR",
    roomId,
    roomEventNo,
    errorCode,
    message
  });
}

function closeConnection(
  context: ConnectionContext,
  activeGuestConnections: Map<string, ConnectionContext>,
  state: RealtimeState,
  markDisconnected: boolean
) {
  context.unsubscribe?.();
  context.unsubscribe = undefined;

  if (
    markDisconnected &&
    context.roomId &&
    context.actor.role === "GUEST" &&
    activeGuestConnections.get(context.actor.guestId)?.id === context.id
  ) {
    activeGuestConnections.delete(context.actor.guestId);

    try {
      state.markParticipantRealtimeDisconnected(context.roomId, context.actor);
    } catch {
      // Ignore disconnect cleanup failures while the socket is already closing.
    }
  }

  context.roomId = undefined;
}

export function attachRealtimeGateway(
  app: FastifyInstance,
  state: RealtimeState,
  env: ServerEnv
) {
  const wss = new WebSocketServer({ noServer: true });
  const activeGuestConnections = new Map<string, ConnectionContext>();

  const handleUpgrade = (
    request: Parameters<typeof wss.handleUpgrade>[0],
    socket: Parameters<typeof wss.handleUpgrade>[1],
    head: Buffer
  ) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const accessToken =
      url.searchParams.get("accessToken") ?? getAccessTokenFromHeaders(request.headers);
    const authContext = state.getAuthContext(accessToken, env);

    if (!authContext) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit("connection", client, request, authContext.actor);
    });
  };

  app.server.on("upgrade", handleUpgrade);

  wss.on("connection", (socket: WebSocket, _request: IncomingMessage, actor: AuthActor) => {
    const context: ConnectionContext = {
      id: randomUUID(),
      socket,
      actor
    };

    const sendPrivateState = (roomId: string) => {
      if (context.actor.role !== "GUEST") {
        return;
      }

      const privateState = state.getRoomPrivateState(roomId, context.actor);

      if (!privateState) {
        return;
      }

      sendMessage(socket, {
        type: "PRIVATE_STATE",
        roomId,
        roomEventNo: privateState.roomEventNo,
        privateState
      });
    };

    const bindRoom = (roomId: string) => {
      context.unsubscribe?.();
      context.unsubscribe = state.subscribeToRoomEvents(roomId, (event) => {
        if (event.type === "ROOM_DIFF") {
          const diff = state.buildRoomRealtimeDiff(roomId, context.actor, event.changed);

          sendMessage(socket, {
            type: "ROOM_DIFF",
            roomId,
            roomEventNo: event.roomEventNo,
            handId: event.handId,
            handSeq: event.handSeq,
            diff
          });
          sendPrivateState(roomId);
          return;
        }

        if (event.type === "HAND_STARTED") {
          sendMessage(socket, event);
          sendPrivateState(roomId);
          return;
        }

        if (event.type === "STREET_ADVANCED" || event.type === "SHOWDOWN_TRIGGERED") {
          sendMessage(socket, event);
          sendPrivateState(roomId);
          return;
        }

        if (event.type === "TURN_STARTED" || event.type === "TURN_WARNING") {
          sendMessage(socket, event);
          sendPrivateState(roomId);
          return;
        }

        if (event.type === "ACTION_ACCEPTED") {
          if (context.actor.role === "GUEST" && context.actor.guestId === event.participantId) {
            sendMessage(socket, event);
            sendPrivateState(roomId);
          }

          return;
        }

        if (
          event.type === "PLAYER_DISCONNECTED" ||
          event.type === "PLAYER_RECONNECTED" ||
          event.type === "ROOM_PAUSED"
        ) {
          sendMessage(socket, event);
          sendPrivateState(roomId);
        }
      });
      context.roomId = roomId;
    };

    socket.on("message", async (rawMessage: RawData) => {
      try {
        const rawText =
          typeof rawMessage === "string" ? rawMessage : rawMessage.toString("utf8");
        const parsed = realtimeClientMessageSchema.parse(JSON.parse(rawText));

        if (parsed.type === "ROOM_SUBSCRIBE") {
          if (context.actor.role === "GUEST") {
            const existing = activeGuestConnections.get(context.actor.guestId);

            if (existing && existing.id !== context.id) {
              existing.socket.close(4001, "Replaced by a newer room connection.");
            }

            activeGuestConnections.set(context.actor.guestId, context);
            state.markParticipantRealtimeConnected(parsed.roomId, context.actor);
          }

          bindRoom(parsed.roomId);
          const snapshot = state.getRoomRealtimeSnapshot(parsed.roomId, context.actor);

          sendMessage(socket, {
            type: "ROOM_SNAPSHOT",
            roomId: parsed.roomId,
            roomEventNo: snapshot.roomEventNo,
            snapshot
          });
          sendPrivateState(parsed.roomId);
          return;
        }

        if (parsed.type === "ROOM_UNSUBSCRIBE") {
          closeConnection(context, activeGuestConnections, state, true);
          return;
        }

        if (context.actor.role !== "GUEST") {
          sendServerError(socket, "ERR_FORBIDDEN", "Only room guests can send realtime player intents.");
          return;
        }

        if (parsed.type === "PLAYER_READY") {
          state.playerReady(parsed.roomId, context.actor, parsed.seatIndex);
          return;
        }

        if (parsed.type === "PLAYER_SIT_OUT") {
          state.playerSitOut(parsed.roomId, context.actor, parsed.effectiveTiming);
          return;
        }

        if (parsed.type === "ACTION_SUBMIT") {
          const result = await state.submitAction(parsed.roomId, context.actor, {
            handId: parsed.handId,
            seqExpectation: parsed.seqExpectation,
            idempotencyKey: parsed.idempotencyKey,
            actionType: parsed.actionType,
            amount: parsed.amount
          });

          if (result.outcome === "accepted") {
            sendMessage(socket, {
              type: "ACTION_ACCEPTED",
              roomId: parsed.roomId,
              roomEventNo: result.roomEventNo,
              handId: result.handId,
              handSeq: result.handSeq,
              participantId: result.participantId,
              seatIndex: result.seatIndex,
              idempotencyKey: result.idempotencyKey,
              actionType: result.actionType,
              normalizedAmount: result.normalizedAmount
            });
            sendPrivateState(parsed.roomId);
            return;
          }

          sendMessage(socket, {
            type: "ACTION_REJECTED",
            roomId: parsed.roomId,
            roomEventNo: result.roomEventNo,
            handId: result.handId,
            handSeq: result.handSeq,
            idempotencyKey: result.idempotencyKey,
            errorCode: result.errorCode,
            message: result.message,
            expectedSeq: result.expectedSeq
          });
          sendPrivateState(parsed.roomId);
          return;
        }

        if (parsed.type === "HISTORY_REQUEST") {
          sendServerError(
            socket,
            "ERR_ACTION_INVALID",
            "Hand history export is not available until a later phase.",
            parsed.roomId
          );
        }
      } catch (error) {
        if (error instanceof AppError) {
          sendServerError(
            socket,
            error.code,
            error.message,
            context.roomId
          );
          return;
        }

        sendServerError(
          socket,
          "ERR_ACTION_INVALID",
          "The realtime payload did not match the expected contract.",
          context.roomId
        );
      }
    });

    socket.on("close", () => {
      closeConnection(context, activeGuestConnections, state, true);
    });
  });

  app.addHook("onClose", async () => {
    app.server.off("upgrade", handleUpgrade);

    for (const client of wss.clients) {
      client.close();
    }

    wss.close();
  });
}

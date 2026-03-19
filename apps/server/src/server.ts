import Fastify from "fastify";

import { getServerEnv, type ServerEnv } from "@potluck/config/server";
import {
  adminOtpRequestSchema,
  adminOtpVerifyRequestSchema,
  authSessionResponseSchema,
  authStatusResponseSchema,
  healthResponseSchema,
  joinRoomRequestSchema,
  joinRoomResponseSchema,
  logoutResponseSchema,
  roomPublicSummarySchema
} from "@potluck/contracts";
import { createEnginePlaceholder } from "@potluck/game-engine";

import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  setAuthCookies
} from "./cookies.js";
import { createResendEmailAdapter, type EmailAdapter } from "./email.js";
import { AppError, appError, sendAppError } from "./errors.js";
import { createPhaseOneState } from "./state.js";

type BuildServerOptions = {
  env?: Partial<Record<keyof ServerEnv, string>>;
  emailAdapter?: EmailAdapter;
  state?: ReturnType<typeof createPhaseOneState>;
};

export function buildServer(options: BuildServerOptions = {}) {
  const env = getServerEnv(options.env);
  const app = Fastify({
    logger: env.NODE_ENV !== "test"
  });
  const engine = createEnginePlaceholder();
  const state = options.state ?? createPhaseOneState();
  const emailAdapter =
    options.emailAdapter ??
    createResendEmailAdapter({
      apiKey: env.RESEND_API_KEY,
      fromEmail: env.RESEND_FROM_EMAIL
    });

  app.decorate("env", env);
  app.decorate("phaseOneState", state);

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", env.APP_ORIGIN);
    reply.header("Access-Control-Allow-Credentials", "true");
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Idempotency-Key"
    );
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    reply.header("Vary", "Origin");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      void sendAppError(reply, error);
      return;
    }

    app.log.error(error);

    void sendAppError(
      reply,
      appError({
        code: "ERR_INTERNAL",
        message: "The server could not process that request.",
        statusCode: 500,
        retryable: false
      })
    );
  });

  const healthHandler = async () =>
    healthResponseSchema.parse({
      status: "ok",
      service: "potluck-server",
      environment: env.NODE_ENV,
      appOrigin: env.APP_ORIGIN,
      engine: engine.name
    });

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  app.get("/api/auth/session", async (request) => {
    const authContext = state.getAuthContext(getAccessToken(request), env);

    if (!authContext) {
      return authStatusResponseSchema.parse({
        authenticated: false
      });
    }

    return authStatusResponseSchema.parse({
      authenticated: true,
      session: authContext.session,
      actor: authContext.actor
    });
  });

  app.post("/api/auth/admin/request-otp", async (request) => {
    const body = adminOtpRequestSchema.parse(request.body);

    try {
      return await state.requestAdminOtp({
        email: body.email,
        ip: request.ip,
        emailAdapter
      });
    } catch (error) {
      if (error instanceof Error && !(error instanceof AppError)) {
        throw appError({
          code: "ERR_EMAIL_DELIVERY_FAILED",
          message: "We could not send the sign-in code email.",
          statusCode: 503,
          retryable: true
        });
      }

      throw error;
    }
  });

  app.post("/api/auth/admin/verify-otp", async (request, reply) => {
    const body = adminOtpVerifyRequestSchema.parse(request.body);
    const result = state.verifyAdminOtp(body.challengeId, body.code, request.ip, env);
    const tokens = state.getSessionTokens(result);

    setAuthCookies(
      reply,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.accessMaxAgeSeconds,
      tokens.refreshMaxAgeSeconds
    );

    return authSessionResponseSchema.parse({
      session: result.session,
      actor: result.actor
    });
  });

  app.post("/api/auth/refresh", async (request, reply) => {
    const result = state.refreshSession(getRefreshToken(request), env);
    const tokens = state.getSessionTokens(result);

    setAuthCookies(
      reply,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.accessMaxAgeSeconds,
      tokens.refreshMaxAgeSeconds
    );

    return authSessionResponseSchema.parse({
      session: result.session,
      actor: result.actor
    });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    state.logout(getAccessToken(request), getRefreshToken(request), env);
    clearAuthCookies(reply);

    return logoutResponseSchema.parse({
      success: true
    });
  });

  app.get("/api/rooms/:code", async (request) => {
    const code = (request.params as { code: string }).code;
    return roomPublicSummarySchema.parse(state.getRoomSummary(code));
  });

  app.post("/api/rooms/:code/join", async (request, reply) => {
    const code = (request.params as { code: string }).code;
    const body = joinRoomRequestSchema.parse(request.body);
    const result = state.joinRoom(code, body.nickname, body.mode, env);
    const tokens = state.getSessionTokens(result);

    setAuthCookies(
      reply,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.accessMaxAgeSeconds,
      tokens.refreshMaxAgeSeconds
    );

    return joinRoomResponseSchema.parse({
      session: result.session,
      actor: result.actor,
      lobbySnapshot: result.lobbySnapshot
    });
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    env: ServerEnv;
    phaseOneState: ReturnType<typeof createPhaseOneState>;
  }
}

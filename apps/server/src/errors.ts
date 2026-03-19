import type { FastifyReply } from "fastify";

import { apiErrorSchema, type ErrorCode } from "@potluck/contracts";

type AppErrorOptions = {
  code: ErrorCode;
  message: string;
  statusCode: number;
  retryable: boolean;
  details?: Record<string, string>;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly details?: Record<string, string>;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable;
    this.details = options.details;
  }
}

export function appError(options: AppErrorOptions) {
  return new AppError(options);
}

export function sendAppError(reply: FastifyReply, error: AppError) {
  const payload = apiErrorSchema.parse({
    error: {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      retryable: error.retryable,
      details: error.details
    }
  });

  return reply.code(error.statusCode).send(payload);
}

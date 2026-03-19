import { z } from "zod";

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1),
  SESSION_SIGNING_SECRET: z.string().min(32),
  GUEST_SESSION_SIGNING_SECRET: z.string().min(32),
  ADMIN_OTP_SIGNING_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SENTRY_DSN: z.string().min(1),
  SENTRY_AUTH_TOKEN: z.string().min(1),
  OTEL_EXPORTER_OTLP_PROTOCOL: z.string().min(1),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().min(1),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().min(1)
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(raw: Record<string, string | undefined> = process.env) {
  return serverEnvSchema.parse(raw);
}

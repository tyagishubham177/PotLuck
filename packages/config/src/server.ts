import { z } from "zod";

const optionalString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}, z.string().min(1).optional());

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
  REDIS_URL: optionalString,
  SENTRY_DSN: optionalString,
  SENTRY_AUTH_TOKEN: optionalString,
  OTEL_EXPORTER_OTLP_PROTOCOL: optionalString,
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalString,
  OTEL_EXPORTER_OTLP_HEADERS: optionalString
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(raw: Record<string, string | undefined> = process.env) {
  return serverEnvSchema.parse(raw);
}

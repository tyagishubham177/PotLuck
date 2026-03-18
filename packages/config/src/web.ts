import { z } from "zod";

export const webEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_APP_ORIGIN: z.string().url(),
  NEXT_PUBLIC_SERVER_ORIGIN: z.string().url(),
  NEXT_PUBLIC_ENV_NAME: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.string().min(1)
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function getWebEnv(raw: Record<string, string | undefined> = process.env) {
  return webEnvSchema.parse(raw);
}

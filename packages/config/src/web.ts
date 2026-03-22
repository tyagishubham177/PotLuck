import { z } from "zod";

const defaultWebEnv = {
  NEXT_PUBLIC_APP_NAME: "PotLuck",
  NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_SERVER_ORIGIN: "http://localhost:3001",
  NEXT_PUBLIC_ENV_NAME: "local",
  NEXT_PUBLIC_SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0"
} satisfies Record<string, string>;

export const webEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_APP_ORIGIN: z.string().url(),
  NEXT_PUBLIC_SERVER_ORIGIN: z.string().url(),
  NEXT_PUBLIC_ENV_NAME: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.string().min(1)
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function getWebEnv(raw: Record<string, string | undefined> = process.env) {
  return webEnvSchema.parse({
    ...defaultWebEnv,
    ...raw
  });
}

import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("potluck-server"),
  environment: z.enum(["development", "test", "production"]),
  appOrigin: z.string().url(),
  engine: z.string().min(1)
});

export const clientSnapshotSchema = z.object({
  appName: z.string().min(1),
  appOrigin: z.string().url(),
  serverOrigin: z.string().url(),
  status: z.enum(["foundation-ready"])
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ClientSnapshot = z.infer<typeof clientSnapshotSchema>;

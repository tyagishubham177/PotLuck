import { getWebEnv } from "@potluck/config/web";
import { clientSnapshotSchema } from "@potluck/contracts";

export type HomePageConfig = {
  appName: string;
  appOrigin: string;
  envName: string;
  serverOrigin: string;
  statusLabel: string;
};

export function getHomePageConfig(
  source: Record<string, string | undefined> = process.env
): HomePageConfig {
  try {
    const env = getWebEnv(source);
    const snapshot = clientSnapshotSchema.parse({
      appName: env.NEXT_PUBLIC_APP_NAME,
      appOrigin: env.NEXT_PUBLIC_APP_ORIGIN,
      serverOrigin: env.NEXT_PUBLIC_SERVER_ORIGIN,
      status: "phase-09-ready"
    });

    return {
      appName: snapshot.appName,
      appOrigin: snapshot.appOrigin,
      envName: env.NEXT_PUBLIC_ENV_NAME,
      serverOrigin: snapshot.serverOrigin,
      statusLabel: snapshot.status
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown configuration error.";
    throw new Error(`Public web configuration is invalid. ${message}`);
  }
}

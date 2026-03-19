import { getWebEnv } from "@potluck/config/web";
import { clientSnapshotSchema } from "@potluck/contracts";

import { PhaseTwoShell } from "./phase-two-shell";

const env = getWebEnv();

const snapshot = clientSnapshotSchema.parse({
  appName: env.NEXT_PUBLIC_APP_NAME,
  appOrigin: env.NEXT_PUBLIC_APP_ORIGIN,
  serverOrigin: env.NEXT_PUBLIC_SERVER_ORIGIN,
  status: "phase-07-ready"
});

export default function HomePage() {
  return (
    <PhaseTwoShell
      appName={snapshot.appName}
      appOrigin={snapshot.appOrigin}
      envName={env.NEXT_PUBLIC_ENV_NAME}
      serverOrigin={snapshot.serverOrigin}
      statusLabel={snapshot.status}
    />
  );
}

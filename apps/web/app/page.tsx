import { AppShellCard } from "@potluck/ui";

import { getHomePageConfig } from "./lib/page-config";
import { PhaseTwoShell } from "./phase-two-shell";

export default function HomePage() {
  try {
    const config = getHomePageConfig();

    return (
      <PhaseTwoShell
        appName={config.appName}
        appOrigin={config.appOrigin}
        envName={config.envName}
        serverOrigin={config.serverOrigin}
        statusLabel={config.statusLabel}
      />
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load the PotLuck web shell.";

    return (
      <main className="page-state-shell">
        <AppShellCard
          description={message}
          eyebrow="Config check"
          title="Public web configuration needs attention"
          tone="critical"
        />
      </main>
    );
  }
}

import { getWebEnv } from "@potluck/config/web";
import { clientSnapshotSchema } from "@potluck/contracts";
import { AppShellCard } from "@potluck/ui";

const env = getWebEnv();

const initialSnapshot = clientSnapshotSchema.parse({
  appName: env.NEXT_PUBLIC_APP_NAME,
  appOrigin: env.NEXT_PUBLIC_APP_ORIGIN,
  serverOrigin: env.NEXT_PUBLIC_SERVER_ORIGIN,
  status: "foundation-ready"
});

export default function HomePage() {
  return (
    <main className="page-shell">
      <AppShellCard
        eyebrow="Phase 00"
        title="PotLuck foundation is live"
        description="The web app, shared packages, and env validation are wired so later phases can focus on game features instead of setup."
      />
      <section className="status-grid">
        <article>
          <h2>Client origin</h2>
          <p>{initialSnapshot.appOrigin}</p>
        </article>
        <article>
          <h2>Server origin</h2>
          <p>{initialSnapshot.serverOrigin}</p>
        </article>
        <article>
          <h2>Workspace status</h2>
          <p>{initialSnapshot.status}</p>
        </article>
      </section>
    </main>
  );
}

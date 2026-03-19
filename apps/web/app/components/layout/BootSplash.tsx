type BootSplashProps = {
  appName: string;
};

export function BootSplash({ appName }: BootSplashProps) {
  return (
    <main className="page-state-shell">
      <section className="boot-splash" aria-busy="true" aria-live="polite">
        <p className="eyebrow">Booting</p>
        <h1>{appName} is syncing your room session</h1>
        <p className="status-text">
          Checking for an active admin or guest session, restoring lobby state, and preparing the
          live table feed.
        </p>
        <div className="boot-grid" aria-hidden="true">
          <div className="boot-card" />
          <div className="boot-card" />
          <div className="boot-card wide" />
        </div>
      </section>
    </main>
  );
}

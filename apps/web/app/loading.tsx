export default function LoadingPage() {
  return (
    <main className="page-state-shell">
      <section className="boot-splash" aria-busy="true" aria-live="polite">
        <p className="eyebrow">Loading</p>
        <h1>Preparing the PotLuck web client</h1>
        <p className="status-text">
          Pulling the initial route bundle and readying the live table shell.
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

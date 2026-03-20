"use client";

import { AppShellCard } from "@potluck/ui";
import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-state-shell">
      <AppShellCard
        description={error.message || "An unexpected error interrupted the PotLuck web shell."}
        eyebrow="Something broke"
        title="The table view hit an unexpected error"
        tone="critical"
      >
        <div className="page-state-actions">
          <button className="primary-button" onClick={reset} type="button">
            Try again
          </button>
        </div>
      </AppShellCard>
    </main>
  );
}

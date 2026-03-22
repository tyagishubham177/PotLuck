# Phase 06: Settlement, Side Pots, and Audit Risks

## Assumptions
- Rake is disabled by default but code path still exists.
- Settlement and ledger share a database transaction boundary.

## Risks
- Side-pot bugs can silently mispay players if coverage is weak.
- Transcript exports may drift from engine truth if duplicated.
- Web clients can display stale room or hero state during Phase 6 integration if settlement updates, reconnect handling, and guest-session replacement are not validated together.
- Cross-tab guest replacement in the same browser context can confuse who the client believes the hero is unless room preview, lobby snapshot, live snapshot, and private state are cleared atomically on auth changes.

## Rollback Notes
- Pause all rooms if settlement invariants fail.
- Do not edit historical ledger rows; use compensating adjustments only.

## Deferred Work
- Replay visualization.
- Future fair-play analytics, including collusion review signals.

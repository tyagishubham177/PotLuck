# Phase 06: Settlement, Side Pots, and Audit Risks

## Assumptions
- Rake is disabled by default but code path still exists.
- Settlement and ledger share a database transaction boundary.

## Risks
- Side-pot bugs can silently mispay players if coverage is weak.
- Transcript exports may drift from engine truth if duplicated.

## Rollback Notes
- Pause all rooms if settlement invariants fail.
- Do not edit historical ledger rows; use compensating adjustments only.

## Deferred Work
- Replay visualization.
- Future fair-play analytics, including collusion review signals.

# Phase 04: Realtime Room Actor Risks

## Assumptions
- One active room actor exists per room at any moment.
- Redis routing hints are advisory, not authoritative.

## Risks
- Reconnect races between old and new sockets.
- Client diff reducer complexity can grow quickly.

## Rollback Notes
- Disable realtime layer and fall back to REST-only lobby if needed.
- Do not roll back persisted event numbers without a data migration plan.

## Deferred Work
- Full hand engine.
- Settlement.
- Rich table UX.

# Phase 04: Realtime Room Actor Implementation

## Sequence
1. Add websocket auth handshake and room subscription flow.
2. Implement room actor registry and consistent routing strategy.
3. Add monotonic event numbering, hand-local sequence handling, and idempotency checks.
4. Implement timer service with stale-token rejection.
5. Render reconnect banners and room diff application in the web shell.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

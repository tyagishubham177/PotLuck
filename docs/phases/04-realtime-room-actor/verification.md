# Phase 04: Realtime Room Actor Verification

## Run Commands
- pnpm test
- pnpm --filter server test
- pnpm --filter web dev

## Manual Checks
- Refreshing the room page reconnects cleanly.
- Duplicate action packet is ignored or deduped.
- Paused room blocks gameplay intents.

## Failure Cases
- Out-of-order packet does not corrupt client state.
- Stale timer callback has no effect.

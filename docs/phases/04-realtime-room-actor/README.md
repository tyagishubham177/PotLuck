# Phase 04: Realtime Room Actor

## Objective
Implement websocket connectivity, room subscription, single-writer actor flow, reconnects, timers, and event ordering.

## Why Now
The authoritative room loop must be in place before the game engine can safely drive hands.

## AI Mode
- Recommended mode: `xtra hi`
- Comment: `xtra hi`; room actors, reconnects, timers, event ordering, and idempotency are easy places for subtle race-condition bugs.

## Prerequisites
- Phase 03 complete.
- Read `docs/02-architecture/room-actor-model.md` and `docs/03-contracts/realtime-events.md`.
- Review `docs/phases/04-realtime-room-actor/ui.md` for reconnect and disconnect state references.

## Touched Packages
- apps/server
- apps/web
- packages/contracts
- packages/test-kit

## Explicit Non-Goals
- Do not implement full Hold'em betting rules yet.
- Do not expose spectator training mode.

## Exit Criteria
- Clients can subscribe to room snapshots and receive ordered diffs.
- Reconnect and timeout infrastructure works.

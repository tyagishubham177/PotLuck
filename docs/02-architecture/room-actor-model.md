# Room Actor Model

## Actor Responsibilities
- Own the authoritative in-memory state for one room.
- Serialize intents into a single ordered event stream.
- Invoke pure game-engine functions for legal actions, dealing, and settlement.
- Persist committed transitions and emit diffs to clients.
- Manage timers, reconnect grace, queue auto-seating, and between-hand admin edits.

## Actor Lifecycle
- Create the room actor immediately after room creation succeeds.
- Keep one actor per active room for the entire `CREATED`, `OPEN`, and `PAUSED` lifecycle.
- Garbage-collect the actor after room close completes or after `12` hours of idle retention for archival export work.
- Single-process actor hosting is sufficient for v1 because expected concurrency is `1` to `2` active rooms.

## Actor Inputs
| Input | Source | Validation |
| --- | --- | --- |
| Admin command | REST or websocket | role, room state, between-hand restrictions |
| Player intent | WebSocket | session, seat, turn, stack, idempotency key |
| Timer tick | Local scheduler | current room phase and expected timer token |
| Recovery signal | Server bootstrap | persisted room snapshot and pending hand state |

## Actor Outputs
| Output | Consumer |
| --- | --- |
| Room diff | connected clients |
| Durable event record | Postgres |
| Presence update | connected clients and optional future coordination layer |
| Metric/log event | observability stack |
| History export job | admin endpoints |

## Ordering Rules
- Only one command is applied at a time per room.
- Every command is tagged with a monotonic room event number.
- Hand actions additionally carry a hand-local sequence number.
- Timer callbacks must include a token tied to the active turn so stale timers are ignored.

## Persistence Boundaries
- Persist before broadcast for any action that changes chips, turn order, or visibility.
- Broadcast before background analytics for non-critical telemetry.
- Settlement, ledger writes, and hand finalization happen in one transaction.

## Recovery Strategy
1. Load room config, seats, last completed hand, and latest active hand events.
2. Rebuild room state by replaying pure engine transitions.
3. Compare derived hash against stored hand hash if present.
4. Resume live play only if reconstruction is deterministic.
5. Otherwise place room in `PAUSED_RECOVERY_REQUIRED` and notify admin.

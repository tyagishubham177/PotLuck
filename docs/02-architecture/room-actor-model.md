# Room Actor Model

## Actor Responsibilities
- Own the authoritative in-memory state for one room.
- Serialize intents into a single ordered event stream.
- Invoke pure game-engine functions for legal actions, dealing, and settlement.
- Persist committed transitions and emit diffs to clients.
- Manage timers, reconnect grace, and between-hand admin edits.

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
1. Load room config, seats, last completed hand, and the latest committed ledger balances.
2. If no hand was in progress, resume normal room operation from the persisted between-hands state.
3. If a hand was in progress at failure time, mark that hand as abandoned for v1 recovery rather than attempting full event replay.
4. Preserve the last committed player stacks, emit an audit event, and return the room to a safe paused or between-hands state for admin review.
5. Resume live play only after the room actor confirms stacks and seat ownership are coherent.

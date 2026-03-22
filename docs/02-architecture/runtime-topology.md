# Runtime Topology

## Production Shape
| Component | Runtime | Responsibility |
| --- | --- | --- |
| `apps/web` | Vercel | Landing pages, room views, admin UI, history UI |
| `apps/server` | Fly.io primary region | REST APIs, websocket gateway, room actors, hand orchestration |
| Postgres | Neon | Durable state, ledger, settlements, audit, exports |
| Redis | Optional later | Not required for v1; reserve for future coordination or presence offloading |
| Observability | Sentry + structured JSON logging | Errors, alerts, and operational debugging |

## Scaling Model
- v1 runs as a single server process in one primary region.
- One room actor handles one table at a time.
- Expected load is `2` concurrent active rooms, so consistent hashing and cross-instance routing are intentionally deferred.
- Scale-out later should preserve the single-writer-per-room rule.

## Restart Recovery
- Server persists every committed action, hand boundary, and settlement milestone.
- On process restart, the instance rehydrates rooms from Postgres using the latest committed room and ledger state.
- A room with an in-flight hand abandons that hand in v1 recovery, keeps the last committed stacks, and reopens in a safe paused or between-hands state.
- One tick means a single scheduler decision interval used by the room actor to evaluate timers and overdue transitions.

## Failure Modes
| Failure | Expected Behavior |
| --- | --- |
| Web refresh | Client reconnects with session token and receives latest room snapshot |
| Server restart | Room rehydrates and resumes or pauses safely |
| Redis loss | No v1 impact because Redis is not on the critical path |
| Postgres write failure | Action rejected or hand paused; no partial settlement commit |
| Graceful shutdown | Stop accepting new joins, finish or pause active rooms, flush final audit writes, then exit |

## Latency Budget
- Action submit to acknowledgement in-region target: under 150 ms.
- Settlement after final action target: under 1 second.
- Reconnect snapshot target: under 2 seconds.

## Environment Split
- Local: single process, local Postgres or managed dev instance.
- Staging: same topology as prod, lower limits, seeded synthetic rooms.
- Production: single primary region for v1 with documented shard-out path.

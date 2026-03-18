# Runtime Topology

## Production Shape
| Component | Runtime | Responsibility |
| --- | --- | --- |
| `apps/web` | Vercel | Landing pages, room views, admin UI, history UI |
| `apps/server` | Fly.io primary region | REST APIs, websocket gateway, room actors, hand orchestration |
| Postgres | Neon | Durable state, ledger, settlements, audit, exports |
| Redis | Upstash | Presence, room routing hints, short-lived reconnect state, pub/sub |
| Resend | Managed | Admin OTP delivery |
| Observability | Sentry + Grafana Cloud | Errors, traces, metrics, alerts |

## Scaling Model
- One room actor handles one table at a time.
- Actors are distributed across Fly.io instances using consistent room hashing.
- Redis stores room-to-instance routing hints; authoritative state still lives in process + Postgres.
- Horizontal scale comes from more room actors, not from parallel writers per room.

## Restart Recovery
- Server persists every committed action, hand boundary, and settlement milestone.
- On process restart, the instance rehydrates rooms from Postgres and resumes timer state from durable timestamps plus Redis hints.
- A room with an in-flight hand reopens in a recoverable paused state if replay from persisted actions cannot prove the exact next transition within one tick.

## Failure Modes
| Failure | Expected Behavior |
| --- | --- |
| Web refresh | Client reconnects with session token and receives latest room snapshot |
| Server restart | Room rehydrates and resumes or pauses safely |
| Redis loss | Existing room actors continue locally; cross-instance routing and presence degrade gracefully |
| Postgres write failure | Action rejected or hand paused; no partial settlement commit |
| Mail outage | Admin OTP issuance suspended; existing sessions continue |

## Latency Budget
- Action submit to acknowledgement in-region target: under 150 ms.
- Settlement after final action target: under 1 second.
- Reconnect snapshot target: under 2 seconds.

## Environment Split
- Local: single process, local Postgres/Redis or managed dev instances.
- Staging: same topology as prod, lower limits, seeded synthetic rooms.
- Production: single primary region for v1 with documented shard-out path.

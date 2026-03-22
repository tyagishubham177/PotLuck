# Phase 04: Realtime Room Actor Implementation

## Sequence
1. Add websocket auth handshake and room subscription flow.
2. Implement room actor registry and consistent routing strategy.
3. Add monotonic event numbering, hand-local sequence handling, and idempotency checks.
4. Implement timer service with stale-token rejection.
5. Render the reconnect target from `ui-targets/reconnect-overlay/`, keeping the table visible beneath the overlay and stating the impact on the current hand.
6. Apply room diffs in the web shell without forcing a full-screen fallback on transient disconnects.

## UI Integration Target
- Reconnect messaging should explain the current seat state, hand outcome, and next step in plain language.
- Recovery UI should feel like a glass layer over the room, not a separate error app.

## Keys and Inputs
### File Targets
- Keep using `apps/server/.env` and `apps/web/.env.local` from earlier phases.

### Needed from You
| Variable(s) | Need in this phase | Site or source | Put the real value in | How to get it |
| --- | --- | --- | --- | --- |
| `REDIS_URL` | Optional | Upstash Redis or another managed Redis | `apps/server/.env` | Only create this if we intentionally test multi-instance routing or optional presence offload. For v1 and single-instance dev, leave the dummy value alone. |

### Setup Steps
1. Do nothing new if we are staying single-instance, which is the default.
2. If we choose to experiment with Redis later, create a small Upstash Redis database and copy its TLS URL into `apps/server/.env`.
3. Keep Redis off the critical path until the docs explicitly promote it from optional to required.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

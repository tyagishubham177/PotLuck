# Test Strategy

## Test Pyramid
| Layer | Coverage |
| --- | --- |
| Unit | hand rules, pot building, min-raise logic, odd-chip assignment, timer decisions |
| Property | shuffle uniqueness, chip conservation, deterministic replay, state invariant preservation |
| Integration | room CRUD, join/seat/buy-in, action legality, reconnect, admin controls |
| Realtime | duplicate intents, stale sequence rejection, out-of-order packet handling |
| Soak | synthetic multi-room traffic, reconnect churn, action bursts |
| Chaos | server restart mid-hand, Redis loss, delayed Postgres responses |
| Manual UAT | critical user journeys and dispute flows |

## Golden Scenarios
- Heads-up preflop all-in.
- Four-way all-in with two side pots.
- Folded contributor excluded from payout.
- Short all-in that does not reopen action.
- Timeout auto-check vs timeout auto-fold.
- Reconnect before and after auto-action.

## Tooling Direction
- Pure engine tests in `packages/game-engine`.
- Contract tests in `packages/contracts`.
- Synthetic player harness in `packages/test-kit`.
- Browser E2E after Phase 07.

# Test Strategy

## Test Pyramid
| Layer | Coverage |
| --- | --- |
| Unit | hand rules, pot building, min-raise logic, odd-chip assignment, timer decisions |
| Property | shuffle uniqueness, chip conservation, deterministic replay, state invariant preservation |
| Integration | room CRUD, join/seat/buy-in, action legality, reconnect, admin controls |
| Realtime | duplicate intents, stale sequence rejection, out-of-order packet handling |
| Manual UAT | critical user journeys and dispute flows |

## Golden Scenarios
- Heads-up dead button.
- Heads-up preflop all-in.
- Four-way all-in with two side pots.
- Folded contributor excluded from payout.
- Split pot with odd chip awarded left of button.
- Short all-in that does not reopen action.
- Timeout auto-check vs timeout auto-fold.
- Reconnect before and after auto-action.

## Tooling Direction
- Pure engine tests in `packages/game-engine`.
- Contract tests in `packages/contracts`.
- Synthetic player harness in `packages/test-kit`.
- Browser E2E uses Playwright after Phase 07.
- Restart recovery is verified as a bounded product rule: preserve committed stacks and abandon the interrupted hand safely.

# Phase 06: Settlement, Side Pots, and Audit Verification

## Run Commands
- pnpm test
- pnpm --filter game-engine test
- pnpm --filter server test
- pnpm --filter web test

## Manual Checks
- Worked examples from docs reproduce exactly in automated fixtures.
- Folded contributor money remains in pots but folded player never wins.
- Odd chip recipient is correct per button position.
- Playwright multi-client check: after a settled hand, every connected player and spectator sees the same final stacks, room phase, and winner outcome.
- Playwright session check: opening another guest session in the same browser context must not leave the original tab showing stale hero, seat, or action-affordance state.
- Playwright navigation check: invalid room-code lookup or join clears stale room preview, lobby, and live-room panels instead of leaving the previous room visible beside an error.

## Failure Cases
- Settlement failure pauses room and exposes no partial payouts.
- Replay of completed hand yields identical pot and winner outputs.
- Reconnect or session refresh after settlement cannot switch the visible hero identity without also resetting room-scoped client state.

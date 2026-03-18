# Phase 06: Settlement, Side Pots, and Audit Verification

## Run Commands
- pnpm test
- pnpm --filter game-engine test
- pnpm --filter server test

## Manual Checks
- Worked examples from docs reproduce exactly in automated fixtures.
- Folded contributor money remains in pots but folded player never wins.
- Odd chip recipient is correct per button position.

## Failure Cases
- Settlement failure pauses room and exposes no partial payouts.
- Replay of completed hand yields identical pot and winner outputs.

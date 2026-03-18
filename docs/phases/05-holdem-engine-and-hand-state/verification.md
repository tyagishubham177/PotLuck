# Phase 05: Hold'em Engine and Hand State Verification

## Run Commands
- pnpm test
- pnpm --filter game-engine test

## Manual Checks
- Heads-up blind behavior is correct.
- Short all-in does not reopen action incorrectly.
- Everyone-all-in auto-deals remaining streets.

## Failure Cases
- Out-of-turn action is rejected.
- Invalid min-raise request returns typed error.

# Phase 05: Hold'em Engine and Hand State Verification

## Run Commands
- pnpm test
- pnpm --filter game-engine test

## Manual Checks
- Heads-up blind behavior is correct.
- Short all-in does not reopen action incorrectly.
- Everyone-all-in auto-deals remaining streets.
- Playwright smoke: admin OTP login, room create, guest join, seat reservation, and buy-in complete end to end.
- Playwright smoke: readying at least two players starts a live hand, posts blinds, exposes the acting seat, and advances the room to `HAND_ACTIVE`.
- Playwright smoke: acting-player timeout resolves to a typed auto-action and returns the room to `BETWEEN_HANDS`.

## Failure Cases
- Out-of-turn action is rejected.
- Invalid min-raise request returns typed error.

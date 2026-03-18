# Phase 01: Auth, Admin, and Guest Entry Verification

## Run Commands
- pnpm --filter web dev
- pnpm --filter server test
- pnpm test

## Manual Checks
- Admin OTP works end to end in dev.
- Guest join rejects duplicate nickname in same room.
- Expired or invalid room code returns typed error.

## Failure Cases
- OTP reuse fails.
- Expired guest token cannot open websocket.

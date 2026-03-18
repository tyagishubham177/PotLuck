# Phase 08: Admin, Spectator, and History Verification

## Run Commands
- pnpm test
- pnpm --filter web dev
- pnpm --filter server test

## Manual Checks
- Spectator cannot see hidden cards before showdown.
- Admin edit during active hand is rejected with clear timing note.
- History export matches live hand outcome.

## Failure Cases
- Kicked player loses room access cleanly.
- Spectator join is rejected with the correct error when spectator mode is disabled.

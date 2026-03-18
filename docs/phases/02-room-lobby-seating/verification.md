# Phase 02: Room, Lobby, and Seating Verification

## Run Commands
- pnpm test
- pnpm --filter web dev
- pnpm --filter server dev

## Manual Checks
- Two guests racing for one seat results in one winner and one typed rejection.
- Waiting list auto-offers seat after release.
- Room config edits persist in lobby.

## Failure Cases
- Expired seat reservation releases automatically.
- Join code expiry blocks fresh joins but not current occupants.

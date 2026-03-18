# Phase 07: Player Table UI Verification

## Run Commands
- pnpm --filter web dev
- pnpm test

## Manual Checks
- Phone viewport supports one-handed action flow.
- Desktop view shows side panels without hiding critical table info.
- Reduced-motion mode remains usable.

## Failure Cases
- Action buttons never show illegal moves.
- Reconnect banner does not cover action controls.

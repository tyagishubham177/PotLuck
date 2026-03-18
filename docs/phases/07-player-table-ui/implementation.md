# Phase 07: Player Table UI Implementation

## Sequence
1. Build table shell, seat ring, board rail, pot badges, and connection/timer indicators.
2. Implement bottom action tray with legal-action rendering and bet sizing controls.
3. Render private hole cards and public board state from shared contracts.
4. Add showdown summary and stack-delta presentation.
5. Implement between-hand top-up and sit-out controls.

## Keys and Inputs
### File Targets
- Keep using the same `apps/server/.env` and `apps/web/.env.local` files from earlier phases.

### Needed from You
- No new external keys are required in this phase.
- UI implementation should work against the existing app origins and server endpoint values already placed in the env files.
- If browser-side monitoring is wanted early, the Phase 09 `NEXT_PUBLIC_SENTRY_DSN` placeholder can be filled sooner, but it is not required to complete this phase.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

# Phase 07: Player Table UI Implementation

## Sequence
1. Build the live table target from `ui-targets/live-player-table/`, including the centered board, pot card, offset dealer chip, and seat pods.
2. Implement the bottom action tray with legal-action rendering and bet sizing controls, preserving the tone hierarchy between `Fold`, `Call`, `Check`, and `Raise`.
3. Render private hole cards and public board state from shared contracts.
4. Add showdown summary and stack-delta presentation using the settlement target from Phase 06.
5. Implement between-hand top-up and sit-out controls, reusing the restock target from Phase 03 where appropriate.
6. Add bespoke stable toggles for `Auto-Post Blinds` and `Sit Out`.

## UI Integration Target
- Pot display should carry weight through typography, not decorative chip art.
- Dealer placement should feel intentionally asymmetric.
- In-hand metadata and history access should stay reachable without crowding the board.
- High-frequency controls must stay inside the lower quarter of the mobile viewport.

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

# Phase 06: Settlement, Side Pots, and Audit Implementation

## Sequence
1. Implement contribution tracking and pot-builder logic.
2. Evaluate winner sets per pot and split with odd-chip handling.
3. Apply optional rake once per hand subject to cap.
4. Commit settlement rows, ledger entries, and audit events transactionally.
5. Render the settlement target from `ui-targets/showdown-settlement/` so the money math lands in a readable player and audit presentation.
6. Add JSON and text transcript exports and golden scenario tests.

## UI Integration Target
- Settlement should present the total pot before the detailed splits.
- Main pot and side pot ownership must be visually distinct without relying on thick borders.
- Net deltas should remain readable under pressure and use `Space Grotesk` for every amount.

## Keys and Inputs
### File Targets
- Keep using the same `apps/server/.env` and `apps/web/.env.local` files from earlier phases.

### Needed from You
- No new external keys are required in this phase.
- Settlement, ledger, and audit correctness should run entirely on the server and database access already configured in Phase 00.
- Keep rake configuration as product data, not as a hidden secret or environment variable.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

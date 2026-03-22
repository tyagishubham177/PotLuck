# Phase 06: Settlement, Side Pots, and Audit Implementation

## Sequence
1. Implement contribution tracking and pot-builder logic.
2. Evaluate winner sets per pot and split with odd-chip handling.
3. Commit settlement rows, ledger entries, and audit events transactionally.
4. Integrate settlement outputs into the room actor and web client so post-hand stacks, hero identity, and room snapshots remain coherent across reconnects and tab/session churn.
5. Render the settlement target from `ui-targets/showdown-settlement/` so the chip math lands in a readable player and audit presentation.
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
- No rake configuration is required in v1.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.
- Treat room-session coherence as part of settlement integration, not a later polish task. The Phase 5 Playwright pass found that failed room lookups can leave older room data visible and that joining a second guest in the same browser context can silently replace the first tab's hero identity unless the client clears and rebuilds state.

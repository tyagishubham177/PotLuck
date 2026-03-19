# Phase 06: Settlement, Side Pots, and Audit Implementation

## Sequence
1. Implement contribution tracking and pot-builder logic.
2. Evaluate winner sets per pot and split with odd-chip handling.
3. Apply optional rake once per hand subject to cap.
4. Commit settlement rows, ledger entries, and audit events transactionally.
5. Integrate settlement outputs into the room actor and web client so post-hand stacks, hero identity, and room snapshots remain coherent across reconnects and tab/session churn.
6. Add JSON and text transcript exports and golden scenario tests.

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
- Treat room-session coherence as part of settlement integration, not a later polish task. The Phase 5 Playwright pass found that failed room lookups can leave older room data visible and that joining a second guest in the same browser context can silently replace the first tab's hero identity unless the client clears and rebuilds state.

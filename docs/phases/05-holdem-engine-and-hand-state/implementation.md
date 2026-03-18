# Phase 05: Hold'em Engine and Hand State Implementation

## Sequence
1. Create pure game-engine types for deck, seats, streets, actions, and hand state.
2. Implement blind posting, ante posting, button advancement, and deal flow.
3. Implement legal action derivation, min-raise logic, and short all-in rules.
4. Implement street advancement and everyone-folded/everyone-all-in shortcuts.
5. Persist action history and expose state transitions to the room actor.

## Keys and Inputs
### File Targets
- Keep using the same `apps/server/.env` and `apps/web/.env.local` files from earlier phases.

### Needed from You
- No new external keys are required in this phase.
- The work is mostly deterministic engine logic and tests, not third-party integration work.
- If any future randomness service is proposed, stop and update the authoritative docs first because v1 randomness stays server-local.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

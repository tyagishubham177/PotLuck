# Phase 05: Hold'em Engine and Hand State Implementation

## Sequence
1. Create pure game-engine types for deck, seats, streets, actions, and hand state.
2. Implement blind posting, ante posting, button advancement, and deal flow.
3. Implement legal action derivation, min-raise logic, and short all-in rules.
4. Implement street advancement and everyone-folded/everyone-all-in shortcuts.
5. Persist action history and expose state transitions to the room actor.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

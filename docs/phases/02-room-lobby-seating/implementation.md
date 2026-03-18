# Phase 02: Room, Lobby, and Seating Implementation

## Sequence
1. Add room persistence schema and short-code generator.
2. Implement room CRUD and config validation.
3. Add seat reservation timers and waiting-list queue model.
4. Build lobby and seat-picker UI with reservation countdown.
5. Expose buy-in quote endpoint based on room settings.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

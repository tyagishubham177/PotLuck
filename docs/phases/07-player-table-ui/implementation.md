# Phase 07: Player Table UI Implementation

## Sequence
1. Build table shell, seat ring, board rail, pot badges, and connection/timer indicators.
2. Implement bottom action tray with legal-action rendering and bet sizing controls.
3. Render private hole cards and public board state from shared contracts.
4. Add showdown summary and stack-delta presentation.
5. Implement between-hand top-up and sit-out controls.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

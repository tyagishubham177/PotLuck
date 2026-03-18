# Phase 08: Admin, Spectator, and History Implementation

## Sequence
1. Build admin drawer with pause/resume, lock/unlock, kick, and between-hand config edits.
2. Add spectator subscription flow and restricted public table rendering.
3. Build hand history list and hand transcript detail pages.
4. Expose JSON and text export routes in the admin UI.
5. Add audit-friendly status copy and room incident banners.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

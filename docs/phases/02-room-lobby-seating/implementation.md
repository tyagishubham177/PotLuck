# Phase 02: Room, Lobby, and Seating Implementation

## Sequence
1. Add room persistence schema and short-code generator.
2. Implement room CRUD and config validation.
3. Build the create-room wizard targets from `ui-targets/create-room-table-basics/`, `ui-targets/create-room-rules-and-access/`, and `ui-targets/create-room-review-and-launch/`.
4. Add room-created share flow from `ui-targets/room-created-share/` so creation ends with a share-ready handoff.
5. Add seat reservation timers and waiting-list queue model.
6. Build the lobby target from `ui-targets/lobby-seat-picker/` plus the full-room queue state from `ui-targets/waiting-list-full-room/`.
7. Expose buy-in quote endpoint based on room settings.

## UI Integration Target
- Room creation should feel like a curated wizard, not a generic admin form.
- Derived values like min buy-in and blind examples must be visible before room creation completes.
- The lobby should keep a roster, seat map, and rule context visible together on large screens.
- Full rooms should transition into an explicit queue flow, not a dead-end message.

## Keys and Inputs
### File Targets
- Keep using `apps/server/.env` and `apps/web/.env.local` from earlier phases.

### Needed from You
- No new external keys are required in this phase.
- Reuse the database, signing, and email values already placed in the env files.
- Leave later-phase observability and optional Redis placeholders unchanged for now.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

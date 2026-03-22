# Phase 08: Admin, Spectator, and History Implementation

## Sequence
1. Build the admin surface target from `ui-targets/admin-console/`, including room controls, room context, and timing-sensitive action guidance.
2. Add spectator subscription flow and the restricted public table target from `ui-targets/spectator-table-view/`.
3. Build the history index target from `ui-targets/hand-history-list/`.
4. Build the audit detail target from `ui-targets/hand-history-detail/`.
5. Expose JSON and text export routes in the admin and history UI.
6. Add audit-friendly status copy and room incident banners.

## UI Integration Target
- Spectators should see the same room language as players, minus private information.
- Admin controls should be organized by purpose and timing, not dumped into one flat menu.
- History should feel like a logbook and review tool, not just a raw table dump.

## Keys and Inputs
### File Targets
- Keep using the same `apps/server/.env` and `apps/web/.env.local` files from earlier phases.

### Needed from You
- No new external keys are required in this phase.
- Export and history work should reuse the database and signing setup already in place.
- If support-only protected artifact storage is added later, treat that as a new architecture decision rather than slipping in an unplanned integration here.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

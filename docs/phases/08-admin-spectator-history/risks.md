# Phase 08: Admin, Spectator, and History Risks

## Assumptions
- Admins and room creators are the same identity in v1.
- History pages can paginate rather than load full archives.

## Risks
- Spectator leaks are high-severity fairness bugs.
- History pages can accidentally duplicate settlement logic if not derived from transcripts.

## Rollback Notes
- Disable spectator mode while preserving player flows.
- Keep history export available via REST even if UI regresses.

## Deferred Work
- Global moderation console.
- Replay viewer.

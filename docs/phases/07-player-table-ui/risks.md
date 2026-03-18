# Phase 07: Player Table UI Risks

## Assumptions
- Design tokens live in `packages/ui` and are reused across screens.
- Server already emits enough data for a private player overlay.

## Risks
- Too much client-side derivation can drift from server truth.
- Mobile layout can become cramped with 9 players and side pots.

## Rollback Notes
- Feature-flag the new table UI while keeping the underlying room state stable.
- Do not change settlement logic as part of a UI rollback.

## Deferred Work
- Hand replay visuals.
- Persistent user personalization.

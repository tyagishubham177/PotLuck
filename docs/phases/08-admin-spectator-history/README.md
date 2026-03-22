# Phase 08: Admin, Spectator, and History

## Objective
Add moderation tools, spectator mode, hand-history browsing, and export surfaces.

## Why Now
Operations and trust require admin control and visible audit outputs once live play exists.

## AI Mode
- Recommended mode: `hi`
- Comment: `hi`, leaning `med`; the feature set is manageable, but role boundaries, spectator privacy, and exports make `hi` safer.

## Prerequisites
- Phase 07 complete.
- Read `docs/04-game/audit-history.md` and `docs/06-ops/runbook.md`.
- Review `docs/phases/08-admin-spectator-history/ui.md` for admin, spectator, and history references.

## Touched Packages
- apps/web
- apps/server
- packages/contracts
- packages/ui

## Explicit Non-Goals
- Do not add replay animation.
- Do not build global account dashboards.

## Exit Criteria
- Admins can moderate rooms and export hands.
- Spectators can view public state safely.
- History screens support dispute review.

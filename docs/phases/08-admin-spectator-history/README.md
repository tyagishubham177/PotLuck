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
- Review the phase-owned target assets under `docs/phases/08-admin-spectator-history/ui-targets/`.

## Touched Packages
- apps/web
- apps/server
- packages/contracts
- packages/ui

## Explicit Non-Goals
- Do not add replay animation.
- Do not build global account dashboards.

## UI Targets
| Screen | Assets | Target To Reach |
| --- | --- | --- |
| Admin console | `ui-targets/admin-console/` | Structured admin navigation, room controls, timing-sensitive actions, and room-state context rather than a bag of buttons. |
| Spectator table view | `ui-targets/spectator-table-view/` | Public-state table layout, waiting list visibility, and a bottom CTA for joining the queue without exposing private cards. |
| Hand history list | `ui-targets/hand-history-list/` | Dashboard-style history index with filters, summary insight blocks, and quick access to exports. |
| Hand history detail | `ui-targets/hand-history-detail/` | Street-by-street audit log, board and pot summary, player deltas, and export affordances for disputes. |

## Exit Criteria
- Admins can moderate rooms and export hands.
- Spectators can view public state safely.
- History screens support dispute review.

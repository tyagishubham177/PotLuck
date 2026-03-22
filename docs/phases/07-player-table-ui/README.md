# Phase 07: Player Table UI

## Objective
Ship the mobile-first player experience for live hands, including action tray, bet controls, table states, and showdown rendering.

## Why Now
Once the backend rules are trustworthy, the product needs a clear and fast interface for real players.

## AI Mode
- Recommended mode: `hi`
- Comment: `hi`, leaning `med`; the UI is lighter than engine work, but private/public state rendering still has correctness traps.

## Prerequisites
- Phase 06 complete.
- Read `docs/05-experience/design-system.md` and `screen-specs.md`.
- Read `docs/05-experience/design.md` for the full visual direction.
- Review the phase-owned target assets under `docs/phases/07-player-table-ui/ui-targets/`, plus the reconnect and settlement targets owned by Phases 04 and 06.

## Touched Packages
- apps/web
- packages/ui
- packages/contracts

## Explicit Non-Goals
- Do not add admin history tooling here.
- Do not add spectator-only layouts beyond public state support.

## UI Targets
| Screen | Assets | Target To Reach |
| --- | --- | --- |
| Live player table | `ui-targets/live-player-table/` | Board and pot centered, offset dealer marker, seat pods around the edge, private cards anchored to the local player, and a bottom action tray that separates fold from positive actions through tone rather than alarm color. |

## Exit Criteria
- A seated player can comfortably play a hand on mobile and desktop web.

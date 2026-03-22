# Design System

## Strategy Link
- Creative direction and durable style rationale live in [design.md](design.md).
- Imported visual references live in [../ui-references/README.md](../ui-references/README.md).

## Visual Direction
- Mood: private club, calm and trustworthy rather than flashy casino noise.
- Theme anchors: deep felt green, graphite surfaces, warm clay accents, and editorial dark-mode typography.
- Table views remain always dark so cards, chips, timers, and state badges stay visually stable across long sessions.
- Intentional asymmetry is encouraged where it improves realism, especially for dealer markers, metadata placement, and stacked overlays.

## Design Tokens
| Token Group | Direction |
| --- | --- |
| Backgrounds | `surface_dim` room, `surface_container_low` table, `surface_container_high` player pods |
| Typography | `Manrope` for headers, `Inter` for body copy, `Space Grotesk` for all numeric values |
| Radius | `md` for containers, `rounded-full` for chips and status badges |
| Elevation | tonal layering first, ambient shadow second, visible borders last |
| Motion | deliberate, quiet, and mechanical rather than playful or bouncy |
| Touch targets | minimum interactive area `48x48` px |

## Hard Rules
- Do not use `1px` solid borders to separate sections or cards.
- Prefer tonal separation over divider lines in every list, drawer, and panel.
- Use `outline_variant` only as a fallback boundary, and only at very low opacity.
- Keep fold and dismiss actions neutral; reserve alarm-red treatments for genuine failures and high-risk warnings.

## Core Components
- App shell with reconnect banner and room context bar
- Seat pods with stack, timer halo, status badges, and offset dealer marker
- Board card rail with street reveal states
- Bottom action tray with legal actions and bet sizing controls
- Buy-in and top-up drawers with inline guardrails
- Pot badge and side-pot stack component
- Admin control drawer and spectator side sheet
- History transcript list and hand detail view

## Interaction Principles
- Primary actions stay within thumb reach on mobile.
- Numeric amounts always show chips and optional BB equivalents using `Space Grotesk`.
- Timers must remain visible without covering cards or action controls.
- Cosmetic motion never delays a legal poker action.
- Floating overlays should use glass treatment so table context remains visible.

## Sound Design
- Card deal: soft felt snap on initial dealing only.
- Chip move: light stack click for committed bets and settlements.
- Timer warning: restrained alert tone only in the warning window.
- Turn notification: short non-jarring cue when action reaches the local player.
- Win: brief positive accent after settlement, never loud enough to mask speech or room audio.
- All sound cues must support mute and per-device volume preference.

## Responsive Rules
- Mobile: single-column table with bottom action tray and slide-up drawers.
- Tablet: preserve bottom tray, move history and admin panels to side sheets.
- Desktop: keep the player table central, with admin, history, and spectator context in side panels.

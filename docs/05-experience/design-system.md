# Design System

## Visual Direction
- Mood: premium card room, calm and trustworthy rather than flashy casino noise.
- Theme anchors: deep felt green, graphite surfaces, warm chip accents, bright readable typography.
- Table views use an always-dark presentation so cards, chips, and timers remain visually stable across sessions.
- Mobile and desktop are both first-class layouts; the system should not treat desktop as a late enhancement.

## Design Tokens
| Token Group | Direction |
| --- | --- |
| Backgrounds | felt green primary, charcoal rails, muted panel overlays |
| Typography | geometric sans for UI, compact monospace for numeric chips and hand ids |
| Radius | medium on panels, pill buttons for primary actions |
| Elevation | shallow shadows, stronger ring states instead of heavy depth |
| Motion | quick card slides, subtle chip pulses, no blocking celebration overlays |
| Touch targets | minimum interactive area `48x48` px |

## Core Components
- App shell with reconnect banner and room context bar
- Seat ring with stack, timer halo, status badges, and dealer marker
- Board card rail with street reveal states
- Action tray with context-aware controls and bet sizing presets
- Buy-in and top-up drawers
- Pot badge and side-pot stack component
- Admin control drawer
- History transcript panel

## Interaction Principles
- Primary actions stay within thumb reach on mobile.
- Numeric amounts always show chips and optional BB equivalent.
- Timers must be visible without covering cards or actions.
- Cosmetic motion never delays actionable controls.

## Sound Design
- Card deal: soft felt snap on initial dealing only.
- Chip move: light stack click for committed bets and settlements.
- Timer warning: restrained alert tone only in the warning window.
- Turn notification: short non-jarring cue when action reaches the local player.
- Win: brief positive accent after settlement, never loud enough to mask speech or call audio.
- All sound cues must support mute and per-device volume preference.

## Responsive Rules
- Mobile: single-column table with bottom action tray and slide-up drawers.
- Tablet: preserve bottom tray, move history and admin panels to side sheets.
- Desktop: use left rail for players 8/9 and right rail for history/admin panels without dropping any core controls.
- Both `375px` mobile and desktop widths are primary targets and must be designed intentionally.

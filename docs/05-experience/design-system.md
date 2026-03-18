# Design System

## Visual Direction
- Mood: premium card room, calm and trustworthy rather than flashy casino noise.
- Theme anchors: deep felt green, graphite surfaces, warm chip accents, bright readable typography.
- Mobile-first layout with one-handed action zones and desktop expansion panels.

## Design Tokens
| Token Group | Direction |
| --- | --- |
| Backgrounds | felt green primary, charcoal rails, muted panel overlays |
| Typography | geometric sans for UI, compact monospace for numeric chips and hand ids |
| Radius | medium on panels, pill buttons for primary actions |
| Elevation | shallow shadows, stronger ring states instead of heavy depth |
| Motion | quick card slides, subtle chip pulses, no blocking celebration overlays |

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

## Responsive Rules
- Mobile: single-column table with bottom action tray and slide-up drawers.
- Tablet: preserve bottom tray, move chat/history to side sheet.
- Desktop: use left rail for players 8/9, right rail for chat/history/admin panels.

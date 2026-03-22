# Design System

## 1. System Contract
This file is the implementation-facing source of truth for PotLuck UI decisions. Product screens, prototypes, and future code must reference these tokens directly rather than inventing local values.

## 2. CSS Custom Properties Contract
Every PotLuck surface must bind to these variables or a documented derivative of them.

```css
:root {
  --potluck-font-display: "Manrope", sans-serif;
  --potluck-font-body: "Inter", sans-serif;
  --potluck-font-mono: "Space Grotesk", sans-serif;

  --potluck-color-ink-950: #0b0d10;
  --potluck-color-graphite-900: #101418;
  --potluck-color-graphite-800: #181c20;
  --potluck-color-graphite-700: #262a2e;
  --potluck-color-graphite-600: #313539;
  --potluck-color-felt-500: #0a6b42;
  --potluck-color-felt-700: #003322;
  --potluck-color-felt-glow: #95d4b3;
  --potluck-color-clay-400: #f0bd8b;
  --potluck-color-clay-700: #65411a;
  --potluck-color-ivory-50: #f7f3eb;
  --potluck-color-teal-turn: #7fd8c6;
  --potluck-color-green-stable: #5fbf8f;
  --potluck-color-amber-warning: #d6a449;
  --potluck-color-red-critical: #c85c53;
  --potluck-color-text-high: rgba(247, 243, 235, 0.96);
  --potluck-color-text-mid: rgba(247, 243, 235, 0.72);
  --potluck-color-text-low: rgba(247, 243, 235, 0.48);

  --potluck-radius-sm: 4px;
  --potluck-radius-md: 8px;
  --potluck-radius-lg: 12px;
  --potluck-radius-xl: 16px;
  --potluck-radius-full: 9999px;

  --potluck-space-1: 4px;
  --potluck-space-2: 8px;
  --potluck-space-3: 12px;
  --potluck-space-4: 16px;
  --potluck-space-5: 20px;
  --potluck-space-6: 24px;
  --potluck-space-7: 28px;
  --potluck-space-8: 32px;
  --potluck-space-10: 40px;
  --potluck-space-12: 48px;
  --potluck-space-14: 56px;
  --potluck-space-16: 64px;

  --potluck-font-size-display-lg: 56px;
  --potluck-line-display-lg: 60px;
  --potluck-track-display-lg: -0.03em;
  --potluck-weight-display-lg: 700;

  --potluck-font-size-display-md: 40px;
  --potluck-line-display-md: 44px;
  --potluck-track-display-md: -0.025em;
  --potluck-weight-display-md: 700;

  --potluck-font-size-title-lg: 28px;
  --potluck-line-title-lg: 34px;
  --potluck-track-title-lg: -0.015em;
  --potluck-weight-title-lg: 650;

  --potluck-font-size-title-md: 22px;
  --potluck-line-title-md: 28px;
  --potluck-track-title-md: -0.012em;
  --potluck-weight-title-md: 650;

  --potluck-font-size-body-lg: 17px;
  --potluck-line-body-lg: 26px;
  --potluck-track-body-lg: -0.008em;
  --potluck-weight-body-lg: 450;

  --potluck-font-size-body-md: 15px;
  --potluck-line-body-md: 22px;
  --potluck-track-body-md: -0.005em;
  --potluck-weight-body-md: 450;

  --potluck-font-size-label-lg: 14px;
  --potluck-line-label-lg: 18px;
  --potluck-track-label-lg: 0.015em;
  --potluck-weight-label-lg: 600;

  --potluck-font-size-label-md: 12px;
  --potluck-line-label-md: 16px;
  --potluck-track-label-md: 0.02em;
  --potluck-weight-label-md: 600;

  --potluck-font-size-label-sm: 11px;
  --potluck-line-label-sm: 14px;
  --potluck-track-label-sm: 0.04em;
  --potluck-weight-label-sm: 600;

  --potluck-shadow-elevation-1: 0 12px 32px rgba(3, 6, 10, 0.20);
  --potluck-shadow-elevation-2: 0 24px 72px rgba(3, 6, 10, 0.32);
  --potluck-shadow-elevation-3: 0 36px 120px rgba(3, 6, 10, 0.44);
  --potluck-glow-primary: 0 0 0 1px rgba(127, 216, 198, 0.18), 0 0 28px rgba(127, 216, 198, 0.20);
  --potluck-glow-secondary: 0 0 0 1px rgba(240, 189, 139, 0.16), 0 0 32px rgba(240, 189, 139, 0.18);
}
```

## 3. Spacing Scale
PotLuck uses a strict `4px` base scale. Designers and implementers should compose from the named tokens above instead of inventing ad hoc values.

- Tight internal padding: `--potluck-space-2` to `--potluck-space-4`
- Standard control gutters: `--potluck-space-4` to `--potluck-space-6`
- Section spacing: `--potluck-space-8` to `--potluck-space-12`
- Page rhythm: `--potluck-space-12` to `--potluck-space-16`

## 4. Typography Contract
| Token | Font | Use |
| --- | --- | --- |
| `display-lg` | Manrope | landing title, major room-close result |
| `display-md` | Manrope | pot total, hero room title, major section title |
| `title-lg` | Manrope | screen headings |
| `title-md` | Inter | elevated section headings and drawer titles |
| `body-lg` | Inter | room description, help copy |
| `body-md` | Inter | standard labels and body copy |
| `label-lg` | Space Grotesk | important numeric labels |
| `label-md` | Space Grotesk | chip counts, blinds, timers |
| `label-sm` | Space Grotesk | seat metadata, tags, timestamps |

Headers must never silently fall back to system fonts. `Manrope` is the visible brand voice, `Inter` is the workhorse, and `Space Grotesk` is mandatory for all numeric values.

## 5. Icon System
PotLuck uses Phosphor Icons.

- Passive navigation and utility states: thin weight.
- Hover and focus states: regular weight with tonal fill.
- Active states: duotone when emphasis helps scanning.
- Icons should never compete with cards, chip values, or player names for attention.

## 6. Radius Contract
- `--potluck-radius-sm`: form fields, tags, micro containers
- `--potluck-radius-md`: buttons, seat cards, compact drawers
- `--potluck-radius-lg`: floating panels and grouped surfaces
- `--potluck-radius-xl`: major drawers and full-screen sheets
- `--potluck-radius-full`: chips, status dots, timer rings, count badges

## 7. Shadow And Glow Tokens
| Token | Purpose | Rule |
| --- | --- | --- |
| `elevation-1` | player pods and sticky nav | ambient, low spread |
| `elevation-2` | floating drawers and inspectors | medium depth, soft edge |
| `elevation-3` | modals and critical overlays | deepest stack, widest spread |
| `glow-primary` | active turn, focus, stable reconnect | teal-green emphasis |
| `glow-secondary` | call, confirm, premium emphasis | clay-gold emphasis |

Only floating surfaces should cast large shadows. Static sections should rely on tonal separation first.

## 8. Navigation Contract
The top bar is locked to:

`PotLuck` | `Lobby · Tables · History` | `[bell] [settings] [avatar]`

Rules:
- Never replace core nav items with tournaments, vault, cashier, or marketing tabs.
- Context is added through breadcrumbs or secondary labels below the top bar.
- Alerts and settings live in the utility cluster, not in the primary nav lane.

## 9. Core Components
- App shell with persistent top bar and optional breadcrumb line
- Seat pod with chip count, timer halo, status badge, and offset dealer button
- Board rail with felt-integrated cards and street labels
- Bet slider with radial knob and snap-point feedback
- Chip stack visualization with layered circles and count badge
- Timer halo with progress ring behavior
- Floating glass drawers for buy-in, top-up, and reconnect context
- Toast notification rail for success, warning, and info feedback
- Hand history list and detail surfaces

## 10. Card Component System
Playing cards have their own material contract.

- Face color: `--potluck-color-ivory-50`
- Radius: `--potluck-radius-md`
- Border: none on standard surfaces; edge definition comes from shadow and contrast
- Inner shadow: subtle, warm, and shallow
- Motion: slight deal rotation, hover tilt on non-live inspection surfaces only
- Suit language: red suits use restrained clay-red, black suits use graphite-ink
- Finish: matte, precise, high-contrast typography

## 11. Interaction Principles
- Tonal depth before borders.
- Motion must communicate game state, not decorate it.
- Numeric surfaces should feel mechanically stable, not jittery.
- Floating surfaces should use glass treatment and preserve context behind them.
- Mobile and desktop are equal primary targets.

## 12. Compliance Audit Rule
Design and implementation reviews should fail if a surface:
- introduces custom colors outside the PotLuck token set
- uses visible `1px` container borders on standard cards or panes
- uses non-`Space Grotesk` number rendering
- changes the top bar contract
- uses dollar signs in product copy
- describes a surface as responsive without specifying mobile behavior

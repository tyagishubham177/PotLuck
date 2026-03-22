# Accessibility And Motion

## Accessibility Rules
- Entire app must be keyboard navigable.
- Every actionable control must have visible focus states and screen-reader labels.
- Suits must be distinguishable by icon shape and not color alone.
- Contrast target: WCAG AA minimum across table backgrounds and controls.
- Timer urgency must use text and icon changes, not color alone.

## Screen Reader Notes
- Announce turn start for the active player.
- Announce street transitions, showdown winners, and large status changes such as pause/resume.
- Keep live-region announcements concise to avoid chatty overload.

## Easing Curves
```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out-cubic: cubic-bezier(0.65, 0.05, 0.36, 1);
--ease-spring: cubic-bezier(0.22, 1.18, 0.36, 1);
```

## Animation Catalog
| Animation | Spec |
| --- | --- |
| Card deal | 120ms staggered fan, slight rotation, `--ease-out-expo` |
| Card flip | 250ms Y-axis rotation for board reveal |
| Chip bet | 200ms slide from acting seat to pot center |
| Pot collection | 300ms sweep from center to winner seat |
| Timer ring | Continuous `stroke-dashoffset` countdown |
| Timer warning | 1Hz opacity pulse between `0.5` and `1.0` |
| Turn indicator | 400ms glow-on around active seat pod |
| Fold | 150ms scale-down and opacity-out for hole cards |
| All-in | 500ms clay-gold border sweep around seat pod |
| Win state | 600ms shimmer plus chip pulse |
| Seat join | 300ms fade-scale-up for new player pod |
| Seat leave | 250ms dissolve-out |
| Drawer open | 350ms slide-up with spring overshoot |
| Toast notification | 200ms slide-in, 3s hold, 200ms slide-out |
| Reconnect pulse | Continuous 2s breathing opacity on glass overlay |
| Board street label | 150ms fade-in for `FLOP`, `TURN`, `RIVER` |
| Navigation transition | 250ms screen crossfade |
| Buy-in preset tap | 120ms press response with subtle glow |
| History row focus | 180ms tonal highlight sweep |

## Reduced Motion Fallback
- Card deal, chip bet, pot collection, seat join, and seat leave reduce to instant opacity and positional state updates.
- Timer ring remains, but warning pulse becomes a static warning color plus text.
- Win shimmer, all-in border sweep, and navigation crossfade should be removed entirely when reduced motion is enabled.
- Drawer open and toast transitions may keep a short opacity fade under 120ms.

## Performance Budget
- No animation may rely on width or height changes.
- Prefer `transform`, `opacity`, filter-safe glow, and SVG stroke animation.
- Keep table-state animation on compositor-friendly layers where possible.
- Target `60fps` on a mid-tier mobile device.
- High-frequency game animation should not block input.

## Motion Principles
- Motion clarifies state or hierarchy, never decoration alone.
- Every motion family should feel mechanical, calm, and deliberate.
- Active-player emphasis should be readable in a quick glance, not flashy.
- Premium does not mean slow; all motion should remain crisp.

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

## Motion Rules
- Card deals: 120 to 180 ms staggered fan.
- Board reveals: short slide/fade with no input lock.
- Timer warning: pulse ring only, no layout shifts.
- Win states: subtle highlight and chip pulse, under 600 ms total.
- Respect reduced-motion preferences by disabling non-essential animation.

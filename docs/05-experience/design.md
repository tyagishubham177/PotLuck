# Design System Strategy: The Private Atelier

## 1. Overview And Creative North Star
The Creative North Star for this design system is **"The Private Atelier."**

Unlike the chaotic, neon-soaked environments of commercial gambling apps, this system draws inspiration from high-end private clubs and bespoke tailoring. We are moving away from the "mobile game" aesthetic toward a "precision instrument" feel. The interface does not shout; it whispers with authority.

We break the "standard template" look by utilizing **intentional asymmetry** and **tonal depth**. By rejecting traditional borders and embracing "The Layering Principle," we create an environment that feels stable, expensive, and calm, allowing the user's focus to remain entirely on the high-stakes logic of the game.

## 2. Colors: The Palette Of Trust
The palette is rooted in the "Deep Felt" experience, utilizing a sophisticated dark-mode architecture that prioritizes long-form visual comfort.

### Core Tones
- **Primary (The Felt):** `#95d4b3` (Primary) to `#00452e` (Primary Container). This is our anchor. Use these for success states and key active players.
- **Secondary (The Clay):** `#f0bd8b` (Secondary) to `#65411a` (Secondary Container). This warm gold evokes the physical weight of high-value clay chips. Reserved for high-priority actions like `Call`, `Confirm`, and all-in emphasis plus pot totals.
- **Surface (The Graphite):** `#101418` (Surface) to `#313539` (Surface Variant). These neutrals provide the "stable room" environment.

### The "No-Line" Rule
**Strict mandate:** Designers are prohibited from using `1px` solid borders to define sections or cards.

Boundaries must be defined through background color shifts or subtle tonal transitions. A player's seat (`surface_container_high`) should sit directly on the table (`surface`) without a stroke. Separation is achieved through the contrast between `#262a2e` and `#101418`.

### Signature Textures And Glass
To avoid a "flat-file" appearance, use glassmorphism for floating overlays like bet sliders or menu drawers. Use `surface_container` tokens with `60-80%` opacity and a `backdrop-blur` of `20px`. This allows the felt green of the table to bleed through while preserving a sense of place.

## 3. Typography: Editorial Precision
The typography is a dialogue between the character-rich **Manrope** and the industrial clarity of **Inter** and **Space Grotesk**.

- **Display and headlines (Manrope):** Used for tournament titles, big wins, and screen headers. It should feel premium and curated.
- **Body and titles (Inter):** The workhorse. Inter's tall x-height keeps card suits and player names legible even at smaller mobile sizes.
- **Data and labels (Space Grotesk):** Used for all numeric values including pot size, stack sizes, blinds, timers, and chip counts. Its tabular feel prevents values from "jumping" when they update quickly.

**Hierarchy as identity:** Use `display-md` for the pot total to give it weight, while using `label-sm` in `on_surface_variant` for administrative metadata such as `Muck`, `Dealer`, or reconnect states.

## 4. Elevation And Depth: Tonal Layering
We reject the standard Material Design shadow-heavy approach in favor of **Ambient Depth**.

- **The Layering Principle:** Stacking determines importance.
- *Level 0:* `surface_dim` (`#101418`) for the room and the full-screen background.
- *Level 1:* `surface_container_low` (`#181c20`) for the table surface and persistent rails.
- *Level 2:* `surface_container_high` (`#262a2e`) for individual player pods and focused controls.
- **Ghost border fallback:** If a container requires a boundary, use `outline_variant` (`#414844`) at `15%` opacity. It should be felt, not seen.
- **Ambient shadows:** For floating elements like the bet radial, use a shadow with `32px` blur, `0px` offset, and `8%` opacity of the `on_background` color.

## 5. Components: The Instrument Set

### Buttons
- **Primary (Secondary/Gold):** Reserved for `Call`, `Confirm`, and high-commitment actions. Uses `secondary_container` with `on_secondary_container` text.
- **Action (Primary/Green):** Reserved for `Check`, `Bet`, or positive progress actions. Uses `primary_container`.
- **Tertiary (Ghost):** For `Fold`, `Close`, or low-emphasis exits. No background, strictly `on_surface_variant` text.

### Chips And Badges
Chips are never literal images. They are stylized circular components using the `secondary` token with `label-md` typography. Use `rounded-full` for all status indicators to contrast against the `md` (`0.375rem`) corners of the main containers.

### Input Fields
Avoid the boxed input look. Use a single `surface_container_highest` block. The focus state is indicated by a shift to `primary_fixed_dim` text color rather than a border change.

### The "No-Divider" List
For hand histories or player lists, do not use horizontal lines. Use vertical white space at spacing scale `4` or `5` to create separation. Content is grouped by proximity, not by a cage.

### Signature Component: The Stable-Toggle
A bespoke toggle for `Auto-Post Blinds`, `Sit Out`, or seat preferences. It uses a subtle `surface_container_highest` track with a `primary` thumb. It must feel mechanical and deliberate, not bouncy.

## 6. Do's And Don'ts

### Do
- Prioritize scannability. Use `Space Grotesk` for every dollar amount, chip count, blind value, and timer.
- Use asymmetry. Place the dealer button in an offset position relative to the player pod so the table feels organic rather than grid-locked.
- Embrace the dark. Keep `90%` of the UI in the `surface` and `surface_container` range to protect the user's eyes during long sessions.

### Don't
- No red for `Fold`. Red triggers panic. Use `tertiary`, `outline`, or neutral text treatment for folding. Only use `error` (`#ffb4ab`) for critical system failures or all-in warnings that genuinely need alarm.
- No skeuomorphism. Do not use textures that look like real wood or real felt. Use color to suggest those materials while keeping the forms modern and flat.
- No high-contrast borders. Never use white or light gray strokes around containers. It breaks the immersion of the "Private Atelier."

## 7. Phase-Owned UI Targets
Concrete UI targets belong inside the phase packs that own them.

- Use `docs/phases/01-auth-admin-and-guest-entry/ui-targets/` for landing and admin verification.
- Use `docs/phases/02-room-lobby-seating/ui-targets/` for room creation, sharing, seating, and waitlist flows.
- Use `docs/phases/03-wallet-buyin-and-ledger/ui-targets/` for buy-in and top-up surfaces.
- Use `docs/phases/04-realtime-room-actor/ui-targets/` for reconnect and disconnect presentation.
- Use `docs/phases/06-settlement-side-pots-and-audit/ui-targets/` for settlement presentation.
- Use `docs/phases/07-player-table-ui/ui-targets/` for the live player table shell.
- Use `docs/phases/08-admin-spectator-history/ui-targets/` for admin, spectator, and history surfaces.

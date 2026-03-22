# Design System Strategy: The Private Atelier

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Private Atelier."** 

Unlike the chaotic, neon-soaked environments of commercial gambling apps, this system draws inspiration from high-end private clubs and bespoke tailoring. We are moving away from the "mobile game" aesthetic toward a "precision instrument" feel. The interface does not shout; it whispers with authority. 

We break the "standard template" look by utilizing **intentional asymmetry** and **tonal depth**. By rejecting traditional borders and embracing "The Layering Principle," we create an environment that feels stable, expensive, and calm—allowing the user’s focus to remain entirely on the high-stakes logic of the game.

---

## 2. Colors: The Palette of Trust
The palette is rooted in the "Deep Felt" experience, utilizing a sophisticated dark-mode architecture that prioritizes long-form visual comfort.

### Core Tones
*   **Primary (The Felt):** `#95d4b3` (Primary) to `#00452e` (Primary Container). This is our anchor. Use these for success states and key active players.
*   **Secondary (The Clay):** `#f0bd8b` (Secondary) to `#65411a` (Secondary Container). This warm gold evokes the physical weight of high-value clay chips. Reserved for high-priority actions (Call/All-in) and pot totals.
*   **Surface (The Graphite):** `#101418` (Surface) to `#313539` (Surface Variant). These neutrals provide the "stable room" environment.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders to define sections or cards. 
Boundaries must be defined solely through background color shifts or subtle tonal transitions. For example, a player’s seat (Surface-Container-High) should sit directly on the table (Surface) without a stroke. Separation is achieved through the contrast between `#262a2e` and `#101418`.

### Signature Textures & Glass
To avoid a "flat-file" appearance, use **Glassmorphism** for floating overlays (e.g., bet sliders or menu drawers). Use `surface_container` tokens with a 60-80% opacity and a `backdrop-blur` of 20px. This allows the "felt" green of the table to bleed through, maintaining a sense of place.

---

## 3. Typography: Editorial Precision
The typography is a dialogue between the character-rich **Manrope** and the industrial clarity of **Inter** and **Space Grotesk**.

*   **Display & Headlines (Manrope):** Used for "Momentum" moments—Tournament Titles, Big Wins, and Screen Headers. It feels premium and curated.
*   **Body & Titles (Inter):** The workhorse. Inter’s tall x-height ensures that card suits and player names are legible even when scaled down on smaller devices.
*   **Data & Labels (Space Grotesk):** Used for all numeric values (Pot size, Stack sizes, Blinds). Its monospaced-leaning qualities ensure numbers don't "jump" when values change rapidly.

**Hierarchy as Identity:** Use `display-md` for the Pot Total to give it "weight," while using `label-sm` in `on_surface_variant` for administrative metadata (e.g., "Muck" or "Dealer").

---

## 4. Elevation & Depth: Tonal Layering
We reject the standard Material Design "shadow-heavy" approach in favor of **Ambient Depth.**

*   **The Layering Principle:** Stacking determines importance.
    *   *Level 0:* `surface_dim` (#101418) - The "Room" / Background.
    *   *Level 1:* `surface_container_low` (#181c20) - The Table surface.
    *   *Level 2:* `surface_container_high` (#262a2e) - Individual player pods.
*   **The Ghost Border Fallback:** If a container requires a boundary (e.g., a card in a hand), use the `outline_variant` (#414844) at **15% opacity**. It should be felt, not seen.
*   **Ambient Shadows:** For floating elements like the "Bet Radial," use a shadow with a 32px blur, 0px offset, and 8% opacity of the `on_background` color.

---

## 5. Components: The Instrument Set

### Buttons (The Interaction Points)
*   **Primary (Secondary/Gold):** Reserved for "Call" or "Confirm." Uses `secondary_container` with `on_secondary_container` text.
*   **Action (Primary/Green):** Reserved for "Check" or "Bet." Uses `primary_container`.
*   **Tertiary (Ghost):** For "Fold" or "Close." No background, strictly `on_surface_variant` text.

### Chips & Badges
Chips are never literal "images." They are stylized circular components using the `secondary` token with `label-md` typography. Use `rounded-full` for all status indicators to contrast against the `md` (0.375rem) corners of the main containers.

### Input Fields (The Bet Slider)
Avoid the "boxed" input look. Use a single `surface_container_highest` block. The focus state is indicated by a shift to `primary_fixed_dim` text color, rather than a border change.

### The "No-Divider" List
For hand histories or player lists, do not use horizontal lines. Use **vertical white space** (Spacing scale `4` or `5`) to create separation. Content is grouped by its proximity, not by its cage.

### Signature Component: The "Stable-Toggle"
A bespoke toggle for "Auto-Post Blinds" or "Sit Out." It uses a subtle `surface_container_highest` track with a `primary` thumb. It must feel mechanical and deliberate, not "bouncy."

---

## 6. Do's and Don'ts

### Do:
*   **Prioritize Scannability:** Use `spaceGrotesk` for every dollar amount or chip count.
*   **Use Asymmetry:** Place the "Dealer Button" in an offset position relative to the player pod to create a more organic, less "grid-locked" feel.
*   **Embrace the Dark:** Keep 90% of the UI in the `surface` and `surface_container` range to protect the user's eyes during long sessions.

### Don't:
*   **No Red for "Fold":** Red triggers panic. Use `tertiary` or `outline` tokens for folding. We only use `error` (#ffb4ab) for critical system failures or "All-in" warnings.
*   **No Skeuomorphism:** Do not use textures that look like real wood or real felt. We use *color* to suggest those materials, keeping the *form* modern and flat.
*   **No High-Contrast Borders:** Never use white or light grey strokes around containers. It breaks the immersion of the "Private Atelier."
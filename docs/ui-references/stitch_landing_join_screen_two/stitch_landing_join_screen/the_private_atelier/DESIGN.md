# Design System: The Private Atelier

## 1. Overview & Creative North Star: "The Hidden Sanctum"
This design system moves away from the neon-soaked, loud aesthetic of traditional gaming apps. Instead, it embraces the "Private Atelier"—a digital translation of a high-stakes, underground parlor where the air is thick with focus and the materials are tactile and expensive.

**The Creative North Star: The Hidden Sanctum.**
We do not build interfaces; we curate environments. The design breaks the "template" look by utilizing intentional asymmetry in its layouts, overlapping surface layers to create depth, and using a high-contrast typography scale that feels like a boutique editorial spread. Every interaction is bottom-anchored, ensuring the "Atelier" is navigable with a single thumb, keeping the user’s focus on the game and the company.

---

## 2. Colors: Tonal Depth & Signature Textures
The palette is rooted in deep, organic greens and graphite, punctuated by the warmth of "Clay" (`tertiary`).

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning content. Boundaries must be defined exclusively through background color shifts. Use `surface-container-low` for secondary sections sitting on a `surface` background. This creates a "milled" look, as if the UI was carved from a single block of material.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
*   **Base:** `surface` (#131313)
*   **De-emphasized:** `surface-container-low` (#1C1B1B)
*   **Interactive/Elevated:** `surface-container-high` (#2A2A2A)
*   **Floating/Active:** `surface-container-highest` (#353534)

### The "Glass & Gradient" Rule
To escape a flat, digital feel, main CTAs should utilize a subtle linear gradient from `primary` (#95D4B3) to `primary-container` (#00452E). For floating modal overlays, use a `backdrop-blur` (20px+) combined with a semi-transparent `surface-variant` to create a "Smoked Glass" effect.

---

## 3. Typography: Editorial Authority
The type system pairs the humanist warmth of **Manrope** with the technical precision of **Space Grotesk**.

*   **Display & Headline (Manrope):** Use `display-md` or `headline-lg` for win states and pot totals. These should be tight-tracked (-2%) to feel authoritative.
*   **Body (Manrope):** `body-md` is the workhorse. It provides the "editorial" feel, providing high readability against dark backgrounds.
*   **Tabular Data (Space Grotesk):** All chip counts, bet amounts, and timers must use `label-md` or `label-sm` in Space Grotesk. The fixed-width nature of the numbers prevents "jumping" layouts during rapid count updates.

---

## 4. Elevation & Depth: Tonal Layering
We reject standard Material shadows. Depth is achieved through the **Layering Principle**.

*   **Ambient Shadows:** If a card must float, use a shadow with a blur of `24px`, spread of `-4px`, and an opacity of `6%`. The shadow color should be a tinted `#000000`.
*   **The Ghost Border Fallback:** If accessibility requires a stroke (e.g., an inactive button on a dark background), use `outline-variant` at **15% opacity**. Never use a 100% opaque stroke.
*   **Tactile Feedback:** Use `surface-bright` (#393939) for pressed states, creating a "pressed-in" look rather than an "outline" look.

---

## 5. Components: Primatives for the Atelier

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary-container`), 12px (`md`) radius. Text: `title-sm` (Manrope Bold).
*   **Secondary:** `secondary-container` fill. No border.
*   **Tertiary (Clay Accent):** Use `tertiary` text on a transparent background for "Fold" or "Exit" actions to provide a warm, cautionary contrast.

### Cards & Lists
*   **Forbid Dividers:** Do not use lines to separate players or hand histories. Use a `0.6rem` (`spacing-3`) vertical gap or shift the background from `surface-container-low` to `surface-container-high`.
*   **Bottom Sheets:** The primary mobile container. Use a `1.5rem` (`xl`) top-corner radius to emphasize the "bottom-anchored" reachability.

### The "Pot" Component (Unique)
*   The pot display should use a `surface-variant` glass card with a `backdrop-blur`. Use `display-sm` (Manrope) for the amount, flanked by `label-md` (Space Grotesk) for the "Current Bet."

### Input Fields
*   **Standard:** `surface-container-highest` background. No border. Active state is indicated by a 2px `primary` underline only, not a full box stroke.

---

## 6. Do's and Don'ts

### Do:
*   **Do** anchor all high-frequency actions (Bet, Check, Raise) within the bottom 25% of the viewport.
*   **Do** use `spacing-10` (2.25rem) for side margins to give the content "breath" and an upscale editorial feel.
*   **Do** use `tertiary-container` (#5C3100) for "Warning" states instead of harsh reds to maintain the "Atelier" palette.

### Don't:
*   **Don't** use pure white (#FFFFFF) for text. Always use `on-surface` (#E5E2E1) to reduce eye strain in dark mode.
*   **Don't** use standard 4px rounding. Stick strictly to the `12px` (`DEFAULT`) and `1rem` (`lg`) scale to maintain the system's "soft-geometric" identity.
*   **Don't** ever use a 1px solid divider. If you feel you need one, increase the spacing instead.
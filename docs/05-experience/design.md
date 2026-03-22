# Design: The Private Atelier v2

## 1. Quiet Luxury Thesis
PotLuck should feel like a precision instrument in a members-only room, not a loud casino app. The interface must read as calm, exact, and materially rich, with the restraint of a watch face rather than the hype of a gaming dashboard.

The product promise is not spectacle. It is confidence. Every screen should suggest that the game state is carefully measured, the room is private, and the visuals are expensive because they are controlled.

## 2. Design Principles
- Quiet luxury over gamer theatrics.
- Mechanical clarity over neon excitement.
- Tonal layering over visible boxes.
- Material cues over skeuomorphic props.
- Calm authority over marketing energy.

## 3. The Depth Stack
| Layer | Name | Purpose | Visual Rule |
| --- | --- | --- | --- |
| 0 | Full-bleed background | Establish the room atmosphere | Barely-there radial gradient, never flat black |
| 1 | Room surface | Hold navigation and structural rails | Subtle graphite plane with `2%` noise texture |
| 2 | Table felt | Anchor live play | Radial green gradient with vignette, never flat fill |
| 3 | Player pods | Express occupancy and turn state | Elevated tonal blocks with ambient shadow |
| 4 | Floating glass panels | Show transient controls and info | Blurred, tinted glass with restrained edge light |
| 5 | Modal and critical dialogs | Interrupt with certainty | Full dim scrim and centered, denser card |

## 4. Color System
### Core Palette
| Token | Hex | HSL | Role |
| --- | --- | --- | --- |
| `ink-950` | `#0b0d10` | `216 18% 5%` | full-bleed background shadow |
| `graphite-900` | `#101418` | `210 22% 8%` | room surface |
| `graphite-800` | `#181c20` | `210 14% 11%` | rails and secondary surface |
| `graphite-700` | `#262a2e` | `210 10% 16%` | player pod and high surface |
| `graphite-600` | `#313539` | `210 8% 21%` | elevated inactive control |
| `felt-500` | `#0a6b42` | `151 83% 23%` | felt center |
| `felt-700` | `#003322` | `160 100% 10%` | felt rim |
| `felt-glow` | `#95d4b3` | `149 41% 70%` | active felt edge glow |
| `clay-400` | `#f0bd8b` | `30 77% 74%` | premium accent |
| `clay-700` | `#65411a` | `31 59% 25%` | accent container |
| `ivory-50` | `#f7f3eb` | `40 43% 95%` | premium card face |
| `signal-red` | `#c85c53` | `5 51% 55%` | disconnected and critical |
| `signal-amber` | `#d6a449` | `39 63% 56%` | warning state |
| `signal-green` | `#5fbf8f` | `150 43% 56%` | connected and stable |
| `signal-teal` | `#7fd8c6` | `169 54% 67%` | active turn glow |

### Status Palette
| State | Color | Behavior |
| --- | --- | --- |
| Connected | `signal-green` | static dot with faint outer glow |
| Unstable | `signal-amber` | soft pulse, never strobe |
| Disconnected | `signal-red` | static indicator, no dramatic flash |
| Active turn | `signal-teal` | halo and controlled glow |
| Folded | `graphite-600` | desaturated, dimmed state |
| Sat out | `graphite-700` + muted label | visibly inactive without alarm |

## 5. The Felt Gradient
The poker table is never a flat fill.

```css
background:
  radial-gradient(circle at 50% 42%, #0a6b42 0%, #085b39 38%, #04412c 68%, #003322 100%);
box-shadow:
  inset 0 0 0 2px hsla(149, 41%, 70%, 0.08),
  inset 0 28px 60px hsla(0, 0%, 0%, 0.20),
  inset 0 -36px 60px hsla(0, 0%, 0%, 0.24);
```

Add a restrained vignette so the board and pot read as the brightest part of the felt without looking theatrical.

## 6. Glass Treatment Spec
Glass is reserved for overlays, drawers, reconnect banners, settlement panels, and floating control groups. It is the one intentional exception to the no-line rule.

```css
background: hsla(200, 10%, 12%, 0.65);
backdrop-filter: blur(20px) saturate(1.2);
-webkit-backdrop-filter: blur(20px) saturate(1.2);
border: 1px solid hsla(0, 0%, 100%, 0.06);
box-shadow:
  0 24px 80px hsla(210, 30%, 3%, 0.42),
  inset 0 1px 0 hsla(0, 0%, 100%, 0.04);
```

Opaque containers should be treated as a design bug when the panel is meant to float over live table state.

## 7. State Color Language
- Teal-green glow means it is your turn.
- Amber pulse means time is running low or connectivity is unstable.
- Dimmed neutral surfaces mean folded or inactive.
- Brighter chip clusters and labels mean actively involved in the current hand.
- Muted graphite surfaces mean waiting, sat out, or passive context.

No state should rely on color alone. Shape, label, icon, and motion must reinforce the meaning.

## 8. Card Material Direction
Playing cards should feel like premium printed stock, not blank white rectangles.

- Card face tone: `ivory-50`, not pure white.
- Corner radius: small but visible, with crisp edge control.
- Subtle inner shadow and edge highlight to imply thickness.
- Suit color coding should stay premium, slightly desaturated, and highly legible.
- Hover or deal motion may introduce slight rotation or parallax, but never cartoon bounce.
- Finish should suggest matte laminate, not glossy plastic.

## 9. Chips And Badges
- Gameplay surfaces use `chips` or `CR` for display units, never currency symbols.
- Chip stacks should look layered and weighted, with count badges rendered in `Space Grotesk`.
- Pot totals and action amounts should feel precise and measured, never noisy or oversized.
- Status badges should look pressed and integrated into the surface, not like third-party pills.

## 10. Navigation Tone
The top bar should feel permanent and restrained:

`PotLuck` brand mark | `Lobby · Tables · History` | utility icons

Phase-specific context belongs in a breadcrumb or secondary label below the top bar. The main navigation must never swap in unrelated labels such as tournaments, cashier, or vault.

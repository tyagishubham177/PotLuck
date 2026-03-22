# Screen Specs

## Spec Format
Each screen contract below includes a desktop behavior, an explicit mobile behavior, a transition, and named loading, empty, and error states. Use chips or `CR` in all surfaced values.

## 1. Landing And Join
| Aspect | Spec |
| --- | --- |
| Target assets | [landing screen](../phases/01-auth-admin-and-guest-entry/ui-targets/landing-join-screen/screen.png), [landing html](../phases/01-auth-admin-and-guest-entry/ui-targets/landing-join-screen/code.html), [admin verification screen](../phases/01-auth-admin-and-guest-entry/ui-targets/admin-verification/screen.png) |
| Desktop layout | Minimal dark poster layout with PotLuck mark, join form, and create CTA. No feature-pill row. |
| Mobile layout | Join form becomes the dominant surface with the create CTA tucked beneath it and recent-room hint collapsed into a secondary line. |
| Transition | `navigation-crossfade` in, 250ms, with a gentle brand fade and form rise. |
| Loading state | Skeleton uses `surface_container` shimmer. Show a brand block, 2 input lines, and 2 button placeholders. |
| Empty state | No recent room: `No saved room yet. Join with a code or host a fresh table.` |
| Error state | Invalid code, expired room, duplicate nickname, and closed room must each map to distinct inline feedback. |
| Motion cues | Brand mark subtle fade-up, form block 80ms delayed rise, active input glow on focus. |

## 2. Create Room Wizard
| Aspect | Spec |
| --- | --- |
| Target assets | [table basics](../phases/02-room-lobby-seating/ui-targets/create-room-table-basics/screen.png), [rules and access](../phases/02-room-lobby-seating/ui-targets/create-room-rules-and-access/screen.png), [review and launch](../phases/02-room-lobby-seating/ui-targets/create-room-review-and-launch/screen.png), [room created share](../phases/02-room-lobby-seating/ui-targets/room-created-share/screen.png) |
| Desktop layout | Four-step progression with sticky summary rail, advanced options collapsed by default, and tonal step markers instead of tabs. |
| Mobile layout | Each step becomes a full-height slide-up sheet with sticky next/back actions. Buy-in guidance moves into expandable helper rows. |
| Transition | Step-to-step horizontal slide with `ease-in-out-cubic`; no hard page replace. |
| Loading state | Skeleton shows step title, 4 field rows, and a locked confirm button on `surface_container`. |
| Empty state | Not applicable; first step is always present. |
| Error state | Invalid blind or buy-in values render inline; between-step validation never relies on a toast alone. |
| Motion cues | Step indicator crossfade, expand/collapse spring for advanced options, subtle confirm-button glow on valid summary. |

## 3. Lobby And Seat Picker
| Aspect | Spec |
| --- | --- |
| Target assets | [lobby seat picker](../phases/02-room-lobby-seating/ui-targets/lobby-seat-picker/screen.png), [waiting list full room](../phases/02-room-lobby-seating/ui-targets/waiting-list-full-room/screen.png), [seat reservation buy-in](../phases/03-wallet-buyin-and-ledger/ui-targets/seat-reservation-buy-in/screen.png) |
| Desktop layout | Table-centered seat map with rules panel and active-player readiness context. Full-room state must be a closed-room message, not a queue workflow. |
| Mobile layout | Seat map remains central; room rules and buy-in limits move into a slide-up drawer. Buy-in presets sit above the custom keypad. |
| Transition | `seat-join-fade-scale` for new occupancy and `drawer-spring-open` for buy-in entry. |
| Loading state | Show 3 placeholder seat pods, one blurred table oval, and 2 rule lines with shimmer. |
| Empty state | `Waiting for players. Two ready seats starts the next hand.` |
| Error state | Seat taken, room full, and buy-in validation failures must all remain anchored near the seat or buy-in action. |
| Motion cues | Seat reserve fade-scale, timer halo warm-up, buy-in drawer spring, top-up preset tap response. |

## 4. In-Hand Table
| Aspect | Spec |
| --- | --- |
| Target assets | [live player table](../phases/07-player-table-ui/ui-targets/live-player-table/screen.png), [reconnect overlay](../phases/04-realtime-room-actor/ui-targets/reconnect-overlay/screen.png) |
| Desktop layout | Felt-first table composition with chips, cards, and board in the primary plane; history and room context sit in a secondary right rail. |
| Mobile layout | Board remains central, action tray stays bottom anchored, secondary context collapses into edge drawers, and history opens as a full-height sheet. |
| Transition | `navigation-crossfade` into room, then stateful in-hand animations only. |
| Loading state | Skeleton uses felt-tinted placeholders: 5 board slots, 3 seat pods, 1 action tray shell, and 1 pot block. |
| Empty state | `Waiting for the next hand.` with readiness status and blinds context. |
| Error state | Reconnect, stale action, or disconnected-state errors render as glass overlays without hiding the table entirely. |
| Motion cues | Card deal fan, chip-bet slide, board reveal slide-flip, pot collection sweep, timer halo countdown, win shimmer, fold fade-scale, all-in border sweep. |

## 5. Showdown And Settlement
| Aspect | Spec |
| --- | --- |
| Target assets | [showdown settlement](../phases/06-settlement-side-pots-and-audit/ui-targets/showdown-settlement/screen.png), [between-hands top-up](../phases/03-wallet-buyin-and-ledger/ui-targets/between-hands-top-up/screen.png) |
| Desktop layout | Total pot first, then pot-by-pot breakdown and winner emphasis, with stack deltas visible beside affected seats. |
| Mobile layout | Winner summary becomes the hero panel; side-pot details collapse into an accordion below the main outcome. |
| Transition | `pot-collection-sweep` into `win-shimmer`, followed by a glass panel rise for settlement details. |
| Loading state | Show 1 total-pot placeholder, 2 winner lines, and 2 pot rows with shimmer on `surface_container_high`. |
| Empty state | Not applicable during a valid settlement flow. |
| Error state | Settlement pending or interrupted state must explain that chips are being reconciled and the next hand is blocked. |
| Motion cues | Pot sweep, subtle golden shimmer, chip pulse on winner, top-up drawer readiness nudge. |

## 6. Session Summary
| Aspect | Spec |
| --- | --- |
| Target assets | No dedicated image yet; must be created in a later mockup pass. |
| Desktop layout | Table-free report surface with stable player rows, final stacks, buy-ins, rebuys, top-ups, and net result. |
| Mobile layout | Summary becomes stacked player cards with a sticky totals bar and expandable detail rows. |
| Transition | `navigation-crossfade` from room close into summary, then row stagger reveal. |
| Loading state | Show 4 player summary rows, 1 totals block, and 1 export action placeholder. |
| Empty state | Never empty for a closed room. Pending calculations use `Preparing session summary...`. |
| Error state | If ledger reconciliation fails, show a critical panel with support-facing context and no partial settle-up. |
| Motion cues | Row fade-up stagger, export CTA glow on hover, no celebratory noise. |

## 7. Settle-Up
| Aspect | Spec |
| --- | --- |
| Target assets | No dedicated image yet; must be created in a later mockup pass. |
| Desktop layout | Tabular summary with CR totals, ratio explanation, and owed/owing grouping. |
| Mobile layout | Each player becomes a compact settle-up card with net chips, derived equivalent, and direction label. |
| Transition | Slide from session summary with a soft crossfade on totals. |
| Loading state | Show 4 row placeholders and 1 ratio explanation placeholder on a glass panel. |
| Empty state | `No settle-up needed. Everyone finished even.` |
| Error state | Invalid or missing chip-to-ratio config should block calculations and point the host to room settings history. |
| Motion cues | Minimal; emphasis is on trust and clarity, not celebration. |

## 8. Admin Console
| Aspect | Spec |
| --- | --- |
| Target assets | [admin console](../phases/08-admin-spectator-history/ui-targets/admin-console/screen.png) |
| Desktop layout | Right-side inspector with room controls, status, moderation actions, and exports under a breadcrumb. |
| Mobile layout | Full-height sheet with grouped control sections and fixed bottom confirmation rail for destructive actions. |
| Transition | Glass drawer rise with spring overshoot; destructive confirmations escalate to modal dim layer. |
| Loading state | Show 3 control groups and 2 action rows in shimmer. |
| Empty state | `No live issues. Room controls are ready.` |
| Error state | Failed moderation or invalid timing must state whether the action is blocked by permissions, hand state, or validation. |
| Motion cues | Drawer open spring, toast confirmation, subtle warning glow on risky actions. |

## 9. History View
| Aspect | Spec |
| --- | --- |
| Target assets | [history list](../phases/08-admin-spectator-history/ui-targets/hand-history-list/screen.png), [history detail](../phases/08-admin-spectator-history/ui-targets/hand-history-detail/screen.png) |
| Desktop layout | Split-pane history list and detail with persistent filtering and quiet metadata rows. |
| Mobile layout | List-first flow with detail pushed as a separate sheet or route; export actions stick to the footer. |
| Transition | List-to-detail crossfade with active-row tonal shift. |
| Loading state | Show 5 list rows and 1 detail transcript block with shimmer. |
| Empty state | `No hands yet. Played hands will appear here once the room starts.` |
| Error state | Export failure or transcript fetch error should preserve the list context and surface retry actions. |
| Motion cues | Active row highlight sweep, transcript fade-in, export toast slide. |

## 10. Spectator View
| Aspect | Spec |
| --- | --- |
| Target assets | [spectator table view](../phases/08-admin-spectator-history/ui-targets/spectator-table-view/screen.png) |
| Status | Future reference only. Spectator mode is still deferred beyond v1. |
| Desktop layout | Read-only table with muted private-card zones, no action tray, and a restrained `Request Seat` CTA. |
| Mobile layout | Read-only table with compressed pods and contextual actions in a bottom sheet instead of live controls. |
| Transition | Same as in-hand table, but without active-player affordance pulses. |
| Loading state | Public-state skeleton with board, seat pods, and room metadata only. |
| Empty state | `No hand in progress. Waiting for the next deal.` |
| Error state | If spectator mode is disabled, explain that the room is private to seated players. |
| Motion cues | Public-state animations only; no private action or turn-control emphasis. |

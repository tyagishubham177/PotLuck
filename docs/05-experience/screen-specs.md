# Screen Specs

## 1. Landing And Join Screen
- Target assets: [landing screen](../phases/01-auth-admin-and-guest-entry/ui-targets/landing-join-screen/screen.png), [landing html](../phases/01-auth-admin-and-guest-entry/ui-targets/landing-join-screen/code.html), [admin verification screen](../phases/01-auth-admin-and-guest-entry/ui-targets/admin-verification/screen.png)
- Sections: product header, room-code join card, create-room CTA, recent room hint for returning admin.
- Primary CTA: `Join by Code`.
- Inputs: room code and nickname for guests; password or PIN for admin create flow.
- A returning admin resume affordance should be visible without overpowering the primary join flow.
- States: loading validation spinner, invalid code, expired code, duplicate nickname, room paused, room closed.
- Empty state: no recent admin room available.

## 2. Create Room Wizard
- Target assets: [table basics](../phases/02-room-lobby-seating/ui-targets/create-room-table-basics/screen.png), [rules and access](../phases/02-room-lobby-seating/ui-targets/create-room-rules-and-access/screen.png), [review and launch](../phases/02-room-lobby-seating/ui-targets/create-room-review-and-launch/screen.png), [room created share](../phases/02-room-lobby-seating/ui-targets/room-created-share/screen.png)
- Step 1: compact admin auth gate for password or PIN.
- Step 2: table basics and cash-game rules: name, seats, blinds, ante, buy-in limits.
- Step 3: advanced options collapsed by default: odd chip rule, straddle, timers, chip-to-dollar ratio, room duration.
- Step 4: summary and create.
- Must surface derived examples such as `40BB min = 4,000 chips`.
- The final review screen should summarize table basics, room rules, and derived buy-in values before create.
- Room creation must end with a share-ready room code screen rather than dropping users straight into the lobby.
- Loading state: create CTA locks and shows progress while room creation is pending.

## 3. Lobby And Seat Picker
- Target assets: [lobby seat picker](../phases/02-room-lobby-seating/ui-targets/lobby-seat-picker/screen.png), [waiting list full room](../phases/02-room-lobby-seating/ui-targets/waiting-list-full-room/screen.png), [seat reservation buy-in](../phases/03-wallet-buyin-and-ledger/ui-targets/seat-reservation-buy-in/screen.png)
- Seat map centered with open, reserved, and occupied states.
- Buy-in quote panel shows min/max and current table rules.
- Buy-in entry should offer preset amounts alongside a custom keypad.
- Ready indicator shows who can start the next hand.
- Full-room state should explain that the table is full and new guests must try again later.
- Empty state: explain that the table needs at least two ready players to start.

## 4. In-Hand Table
- Target assets: [live player table](../phases/07-player-table-ui/ui-targets/live-player-table/screen.png), [reconnect overlay](../phases/04-realtime-room-actor/ui-targets/reconnect-overlay/screen.png)
- Center: board, pot size, side-pot badges.
- Around table: seats with stack, timer, action labels, and folded/all-in states.
- Dealer marker should be offset rather than perfectly centered on the seat card.
- Bottom tray: fold/check/call/bet/raise/all-in, quick-bet presets (`1/2 pot`, `3/4 pot`, `pot`, `all-in`), numeric keypad, slider.
- Side panel: hand id, connection quality, and history access.
- Private cards always anchored near the player edge.
- Layout must work intentionally on both `375px` mobile screens and full desktop widths; neither layout is a secondary adaptation.
- Disconnect overlay: modal or banner that explains reconnect status, current hand impact, and whether auto-action rules still apply.
- Reconnect handling should leave the table visible underneath the overlay instead of dropping into a generic error page.

## 5. Showdown And Settlement
- Target assets: [showdown settlement](../phases/06-settlement-side-pots-and-audit/ui-targets/showdown-settlement/screen.png), [between-hands top-up](../phases/03-wallet-buyin-and-ledger/ui-targets/between-hands-top-up/screen.png)
- Winning hand cards highlighted.
- Total pot should read first, then the per-pot breakdown for main and side pots.
- Pot breakdown panel lists each pot, eligible winners, odd-chip recipient, and net chip deltas.
- Side-pot badges remain visible until next hand prep.
- Rebuy/top-up drawer may open after final settlement if player is under target stack.
- Loading state: settlement skeleton placeholders until payouts are fully confirmed.

## 6. Session Summary
- Presented immediately after room close with a stable, exportable breakdown by player.
- Show total buy-ins, final stack, net chips, and notable events such as add-ons or rebuys.
- Empty state should never appear for a closed room; if calculation is pending, show a deterministic loading state.

## 7. Settle-Up
- Uses chips-only language in the UI while also showing the derived real-money equivalent from the room ratio.
- Each row should show net chips, converted amount, and whether the player owes or is owed.
- Copy should make it clear this is a summary for the private group, not an in-app payment flow.

## 8. Admin Console
- Target assets: [admin console](../phases/08-admin-spectator-history/ui-targets/admin-console/screen.png)
- Drawer or side sheet with room config, pause/resume, lock/unlock, kick, export, and incident notices.
- The admin surface should also expose room events, timing-sensitive constraints, and active settlement context when relevant.
- Any control that only works between hands must show timing requirements inline.
- Error state: action feedback must explain whether the request failed because of room state, permissions, or validation.

## 9. History View
- Target assets: [history list](../phases/08-admin-spectator-history/ui-targets/hand-history-list/screen.png), [history detail](../phases/08-admin-spectator-history/ui-targets/hand-history-detail/screen.png)
- Hand list with timestamps, stack deltas, and player names.
- The list view may include quick insight summaries such as largest pot and showdown/fold distributions.
- Hand detail shows transcript, street actions, board, settlements, and export buttons.
- Detail view should support both a clean street-by-street audit path and export affordances.
- Empty state: no completed hands yet.

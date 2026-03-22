# Screen Specs

## 1. Landing And Join Screen
- Sections: product header, room-code join card, create-room CTA, recent room hint for returning admin.
- Primary CTA: `Join by Code`.
- Inputs: room code and nickname for guests; password or PIN for admin create flow.
- States: loading validation spinner, invalid code, expired code, duplicate nickname, room paused, room closed.
- Empty state: no recent admin room available.

## 2. Create Room Wizard
- Step 1: compact admin auth gate for password or PIN.
- Step 2: table basics and cash-game rules: name, seats, blinds, ante, buy-in limits.
- Step 3: advanced options collapsed by default: odd chip rule, straddle, timers, chip-to-dollar ratio, room duration.
- Step 4: summary and create.
- Must surface derived examples such as `40BB min = 4,000 chips`.
- Loading state: create CTA locks and shows progress while room creation is pending.

## 3. Lobby And Seat Picker
- Seat map centered with open, reserved, and occupied states.
- Buy-in quote panel shows min/max and current table rules.
- Buy-in entry should offer preset amounts alongside a custom keypad.
- Ready indicator shows who can start the next hand.
- Full-room state should explain that the table is full and new guests must try again later.
- Empty state: explain that the table needs at least two ready players to start.

## 4. In-Hand Table
- Center: board, pot size, side-pot badges.
- Around table: seats with stack, timer, action labels, and folded/all-in states.
- Bottom tray: fold/check/call/bet/raise/all-in, quick-bet presets (`1/2 pot`, `3/4 pot`, `pot`, `all-in`), numeric keypad, slider.
- Side panel: hand id, connection quality, and history access.
- Private cards always anchored near the player edge.
- Layout must work intentionally on both `375px` mobile screens and full desktop widths; neither layout is a secondary adaptation.
- Disconnect overlay: modal or banner that explains reconnect status, current hand impact, and whether auto-action rules still apply.

## 5. Showdown And Settlement
- Winning hand cards highlighted.
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
- Drawer or side sheet with room config, pause/resume, lock/unlock, kick, export, and incident notices.
- Any control that only works between hands must show timing requirements inline.
- Error state: action feedback must explain whether the request failed because of room state, permissions, or validation.

## 9. History View
- Hand list with timestamps, stack deltas, and player names.
- Hand detail shows transcript, street actions, board, settlements, and export buttons.
- Empty state: no completed hands yet.

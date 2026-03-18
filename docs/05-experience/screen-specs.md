# Screen Specs

## 1. Landing And Join Screen
- Sections: product header, room-code join card, create-room CTA, recent room hint for returning admin.
- Primary CTA: `Join by Code`.
- Inputs: room code, nickname, spectate toggle.
- States: invalid code, expired code, duplicate nickname, room paused, room closed.

## 2. Create Room Wizard
- Step 1: auth gate for admin email OTP.
- Step 2: table basics: name, seats, blinds, ante.
- Step 3: rules: buy-in limits, odd chip, spectators, chat, straddle.
- Step 4: summary and create.
- Must surface derived examples such as `40BB min = 4,000 chips`.

## 3. Lobby And Seat Picker
- Seat map centered with open, reserved, occupied, and queued states.
- Buy-in quote panel shows min/max and current table rules.
- Waiting-list card appears if no seat is available.
- Ready indicator shows who can start the next hand.

## 4. In-Hand Table
- Center: board, pot size, side-pot badges.
- Around table: seats with stack, timer, action labels, and folded/all-in states.
- Bottom tray: fold/check/call/bet/raise/all-in, presets, numeric keypad, slider.
- Side panel: chat, notes, hand id, connection quality.
- Private cards always anchored near the player edge.

## 5. Showdown And Settlement
- Winning hand cards highlighted.
- Pot breakdown panel lists each pot, eligible winners, odd-chip recipient, and net chip deltas.
- Side-pot badges remain visible until next hand prep.
- Rebuy/top-up drawer may open after final settlement if player is under target stack.

## 6. Spectator View
- Same public table layout without private cards or action tray.
- Optional delay badge if streamer mode is active.
- Join queue or request seat CTA if room settings allow conversion from spectator to player.

## 7. Admin Console
- Drawer or side sheet with room config, pause/resume, lock/unlock, mute/kick, export, and incident notices.
- Any control that only works between hands must show timing requirements inline.

## 8. History View
- Hand list with timestamps, stack deltas, and player names.
- Hand detail shows transcript, street actions, board, settlements, and export buttons.

# User Flows

## Admin Creates A Room
1. Admin lands on create-room screen.
2. Admin authenticates with the configured password or PIN if not already signed in.
3. Admin sets table name, seat count, blinds, ante, buy-in rules, chip-to-dollar ratio, and straddle settings.
4. Server validates config and creates room, room code, audit entry, and initial room state.
5. Admin sees share screen with code, QR-friendly view, and room settings summary.

## Guest Joins And Sits
1. Guest enters room code and nickname.
2. Server validates code, expiry, room status, and nickname uniqueness.
3. Guest enters lobby and sees seat map plus buy-in boundaries.
4. Guest selects seat and receives temporary reservation.
5. Guest chooses buy-in within allowed range.
6. Server commits seat, stack, ledger entry, and ready status.
7. Guest session persists across browser close via signed cookie until expiry or explicit leave.

## In-Hand Action
1. Server emits `TURN_STARTED` for the acting player and public timer metadata for all viewers.
2. Acting client renders context-aware actions only.
3. Client submits intent with idempotency key and expected hand sequence.
4. Server validates turn ownership, action legality, stack size, and raise semantics.
5. Server persists action record, mutates room actor state, and broadcasts diffs.

## Between Hands Top-Up
1. Hand settles and room enters `WAITING_NEXT_HAND`.
2. Eligible seated players see quick top-up drawer.
3. Player chooses top-up amount up to max table buy-in.
4. Server applies ledger entry and updates next-hand stack.

## Session Ends And Settle-Up
1. Admin closes the room manually or the room reaches its max duration.
2. Server finalizes the room, blocks new joins and new hands, and derives a session summary from the room ledger.
3. PotLuck shows each player's total buy-ins, final stack, and net chip gain or loss.
4. PotLuck applies the configured chip-to-dollar ratio to derive settle-up amounts for the private friend group.
5. Admin can export the final summary for follow-up outside the app.

## Reconnect During Hand
1. Player loses socket during an active hand.
2. Server marks the player disconnected, keeps seat ownership, and keeps the turn timer moving under normal timeout rules.
3. Other clients receive a disconnect status update for that seat.
4. Player reloads or reopens the app and presents the existing session cookie or token.
5. Server re-authenticates the session, rebinds realtime subscription, and sends fresh `ROOM_SNAPSHOT` plus `PRIVATE_STATE`.
6. If the player reconnects before auto-action or hand end, they continue from the latest legal state.
7. If auto-fold or auto-check already occurred, the player resumes as an observer of the remaining hand and stays eligible for the next hand if still seated.

## Player Leaves Mid-Hand
1. Player closes the browser, loses connectivity, or explicitly leaves during a hand.
2. If the player explicitly leaves while cards are live, the leave is treated as a disconnect until the hand resolves.
3. The seat remains occupied and any contributed chips remain in eligible pots.
4. Turn handling follows the same timeout rules as any disconnected player.
5. After settlement, the player is returned to `Lobby` if they explicitly left, or remains seated if the event was only a temporary disconnect.

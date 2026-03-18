# User Flows

## Admin Creates A Room
1. Admin lands on create-room screen.
2. Admin authenticates with email OTP if not already verified.
3. Admin sets table name, seat count, blinds, ante, buy-in rules, spectator/chat/emoji/straddle flags.
4. Server validates config and creates room, room code, audit entry, and initial room state.
5. Admin sees share screen with code, QR-friendly view, and room settings summary.

## Guest Joins And Sits
1. Guest enters room code and nickname.
2. Server validates code, expiry, room status, and nickname uniqueness.
3. Guest enters lobby and sees seat map plus buy-in boundaries.
4. Guest selects seat and receives temporary reservation.
5. Guest chooses buy-in within allowed range.
6. Server commits seat, stack, ledger entry, and ready status.

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

## Spectator Join
1. User enters room code as spectator.
2. Server checks spectator setting and room availability.
3. Spectator receives public room state, board, pot, timer, and showdown visibility only.
4. Spectator never receives hidden cards unless open training mode is enabled.

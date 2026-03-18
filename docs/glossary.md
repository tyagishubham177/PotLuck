# Glossary

## Core Terms
| Term | Meaning |
| --- | --- |
| room actor | The single authoritative in-memory worker that owns one room's ordered state transitions. |
| intent | A client request to perform an action, such as `ACTION_SUBMIT` or `PLAYER_SIT_OUT`. |
| room event number | Monotonic sequence number attached to every committed room-level event for ordering and replay. |
| hand sequence | Hand-local action sequence number used to order betting actions inside one hand. |
| settlement | The deterministic process of building pots, resolving winners, applying rake, and writing payouts. |
| ledger entry | Append-only chip accounting record for buy-ins, top-ups, rebuys, rake, and payouts. |
| side pot | A pot created when one or more players are all-in for less than other live stacks. |
| odd chip | Remainder chip left after an even split, awarded by the room's odd-chip rule. |
| commitment hash | Pre-hand cryptographic hash proving the server committed to a deck order before cards were revealed. |
| reveal artifact | Post-hand material used to verify the earlier commitment without exposing future-hand entropy. |
| guest session | Room-scoped signed session that lets a guest rejoin with the same identity until expiry. |
| reserved seat | Temporary seat hold that exists before buy-in is completed. |
| occupant type | Enum describing whether a seat is empty, admin-controlled, or guest-controlled. |
| reconnect safe-stop | Timer behavior that freezes turn countdown progression only while the room is paused or in verified recovery handling. |
| waiting list entry | Queue record representing a player waiting for the next seat opportunity in a room. |
| dead button | Button placement case where the nominal button seat is empty but blind obligations still advance. |
| straddle | Optional blind raise posted before cards are dealt; v1 supports UTG straddle only. |
| hand transcript | Durable record of one hand's actions, board, pots, winners, and audit metadata. |

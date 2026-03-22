# Room Rules

## Room Configuration
| Setting | Type | Default | Validation | Editable Between Hands |
| --- | --- | --- | --- | --- |
| Table name | Short text | `PotLuck Table` | 3 to 40 chars | Yes |
| Room code | 6 to 8 chars | Generated | Uppercase, no ambiguous chars | No |
| Max seats | Integer | 6 | 2 to 9 | No |
| Variant | Enum | `HOLD_EM_NL` | v1 only supports Hold'em | No |
| Small blind | Chips | 50 | positive integer | Yes |
| Big blind | Chips | 100 | defaults to `2x` small blind | Yes |
| Ante | Chips | 0 | zero or positive integer | Yes |
| Buy-in mode | Enum | `BB_MULTIPLE` | `BB_MULTIPLE` or `ABSOLUTE` | Yes |
| Min buy-in | Chips or BB multiple | 40 BB | must be `< max` | Yes |
| Max buy-in | Chips or BB multiple | 250 BB | must be `> min` | Yes |
| Chip-to-dollar ratio | Decimal | `100 chips = 1 unit` | positive decimal, display-only in settle-up | Yes |
| Odd chip rule | Enum | `LEFT_OF_BUTTON` | `LEFT_OF_BUTTON` only in v1 | Yes |
| Straddle allowed | Boolean | false | UTG only in v1 | Yes |
| Seat reservation timeout | Seconds | 120 | 30 to 300 | Yes |
| Join code expiry | Minutes | 120 | 30 to 1440 | Yes |
| Room max duration | Minutes | 600 | 60 to 720; production defaults to 600 | No |

## Room Status Lifecycle
- `CREATED`: config accepted, room code assigned, lobby not yet open.
- `OPEN`: joins, seating, and gameplay allowed subject to normal rules.
- `PAUSED`: room visible but no new hand actions are accepted until resumed.
- `CLOSED`: room ended manually or by max-duration timeout; no new joins or gameplay.

## Seat Rules
- Seats are indexed clockwise from `0`.
- A seat can be `EMPTY`, `RESERVED`, `OCCUPIED`, or `LOCKED_DURING_HAND`.
- Seat selection is first-come, first-committed.
- A reservation starts when a player clicks an open seat and ends when buy-in succeeds or the timer expires.
- If a user disconnects before completing buy-in, the seat reservation is released.

## Join Rules
- Guest players join with room code + nickname.
- Nickname must be unique among active room occupants and guest sessions.
- A nickname becomes available again after the player fully leaves the room or the guest session expires.
- If no seat is free, the join request is rejected with `ERR_ROOM_FULL`.
- One admin may own only one active room at a time in v1.

## Table Rules
- A player may not change seats during an active hand.
- Top-up and rebuy are only allowed between hands.
- Sit-out takes effect immediately if not in hand, otherwise next-hand by default.
- A room auto-closes after `10` hours from creation by default, and dev/test environments may lower the limit to as little as `60` minutes.

## Settlement Rules
- Table stakes apply: only the chips on the table at hand start are live for that hand.
- Folded players keep contributed chips in eligible pots but are excluded from awards.
- Odd chips are distributed to the first winning seat left of the button, then clockwise through the winning set for additional remainder chips.
- When a room closes, PotLuck derives a session summary and settle-up view using the room's configured chip-to-dollar ratio.

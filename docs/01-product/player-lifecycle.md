# Player Lifecycle

## Player States
| State | Meaning | Entered By | Exits To |
| --- | --- | --- | --- |
| Disconnected | No live session or socket | Network loss, leave, initial state | Connecting |
| Connecting | Session valid, realtime not ready | Socket handshake | Lobby, Spectating |
| Lobby | In room, not seated | Join success | Reserved, Spectating, Disconnected |
| Reserved | Seat selected, buy-in pending | Seat reservation, rebuy intent | Seated, Lobby, Disconnected |
| Seated | At table, not in current hand | Buy-in complete or hand ended | Active, Sitting Out, Lobby |
| Sitting Out | Seated but skipped for dealing | User/admin action | Seated, Active, Disconnected |
| Active | In current hand and still eligible to act/win | Hand start | Folded, All-In, Seated |
| Folded | In current hand but ineligible to win | Fold action, timeout auto-fold | Seated |
| All-In | No further action possible | All-in action or short call | Seated |
| Busted | Zero room chips and no immediate rebuy taken | Settlement | Reserved, Lobby, Disconnected |
| Spectating | Watching public table state only | Spectator join | Lobby, Disconnected |

## Timers
| Timer | Default | Behavior |
| --- | --- | --- |
| Room join code expiry | 2 hours | New joins blocked until renewed |
| Seat reservation | 120s | Releases seat if buy-in not completed |
| Reconnect grace | 60s | Player keeps seat and pending turn handling rules apply |
| Action timer | 20s | Warning at 5s; auto action on expiry |

## Action Timeout Rules
- If the player can check, auto action is `CHECK`.
- If the player cannot check, auto action is `FOLD`.
- If the player is disconnected during their turn, the same timer and auto-action rules apply.
- Timeout events must be written to both hand action history and room audit logs.

## Reconnect Rules
- Guest session persistence survives browser close through a signed cookie-backed session until expiry or explicit leave.
- Session rejoin restores room role, seat, chip stack, and current public/private view.
- Hole cards are re-sent only to the owning player after re-authenticated reconnect.
- Duplicate live sockets for one player cause the older socket to be retired.
- If reconnect occurs after auto-fold, the player remains folded for that hand.

## Sit-Out Auto Remove
- A seated player who skips `3` consecutive hands while marked sitting out is automatically removed from the seat and returned to `Lobby`.
- Auto-remove resets if the player becomes active in any intervening hand.
- Auto-remove events must be recorded in room audit history.

## Busted And Re-Buy Path
- A busted player may choose `Rebuy` between hands and move from `Busted` to `Reserved` while keeping room membership.
- If rebuy is not completed before the reservation timer expires, the player returns to `Lobby`.
- A busted player who declines rebuy remains in the room as a lobby player and may spectate if enabled.

## Admin Interventions
- Admin can kick a lobby player immediately.
- Admin can remove a seated player only between hands unless a severe moderation action is required.

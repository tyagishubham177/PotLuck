# Error Codes

## Room And Seating
| Code | Meaning | Retry |
| --- | --- | --- |
| `ERR_ROOM_NOT_FOUND` | Room code invalid or expired | No |
| `ERR_ROOM_FULL` | No seats and queue disabled/full | Maybe |
| `ERR_SEAT_TAKEN` | Seat already reserved or occupied | Maybe |
| `ERR_SEAT_LOCKED` | Seat change blocked during hand | No |
| `ERR_JOIN_NAME_CONFLICT` | Nickname already active in room | Yes |

## Auth And Permissions
| Code | Meaning | Retry |
| --- | --- | --- |
| `ERR_AUTH_REQUIRED` | Missing or expired session | Yes |
| `ERR_OTP_INVALID` | OTP incorrect | Yes |
| `ERR_OTP_EXPIRED` | OTP no longer valid | Yes |
| `ERR_FORBIDDEN` | Role lacks permission | No |

## Gameplay
| Code | Meaning | Retry |
| --- | --- | --- |
| `ERR_NOT_YOUR_TURN` | Intent from non-acting player | No |
| `ERR_ACTION_INVALID` | Action illegal in current state | Yes |
| `ERR_ACTION_TIMEOUT` | Turn expired before intent was accepted | Maybe |
| `ERR_STALE_SEQUENCE` | Client submitted outdated sequence | Yes |
| `ERR_INSUFFICIENT_STACK` | Amount exceeds live chips | Yes |
| `ERR_MIN_RAISE` | Raise smaller than legal minimum | Yes |

## Buy-In And Ledger
| Code | Meaning | Retry |
| --- | --- | --- |
| `ERR_MIN_BUYIN` | Amount below room minimum | Yes |
| `ERR_MAX_BUYIN` | Amount above room maximum | Yes |
| `ERR_TOPUP_DURING_HAND` | Top-up attempted while hand active | Later |
| `ERR_REBUY_DISABLED` | Room does not allow rebuy in current state | No |
| `ERR_LEDGER_COMMIT_FAILED` | Durable write failed | Maybe |

## Moderation And Room Admin
| Code | Meaning | Retry |
| --- | --- | --- |
| `ERR_ROOM_PAUSED` | Room is paused | Later |
| `ERR_CONFIG_EDIT_DURING_HAND` | Gameplay settings can only change between hands | Later |
| `ERR_PLAYER_MUTED` | Chat not allowed for this player | Later |

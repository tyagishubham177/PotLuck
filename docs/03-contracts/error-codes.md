# Error Codes

## Room And Seating
| Code | Meaning | HTTP | Retry |
| --- | --- | --- | --- |
| `ERR_ROOM_NOT_FOUND` | Room code invalid or expired | `404` | No |
| `ERR_ROOM_CLOSED` | Room exists but is no longer open for joins or play | `409` | No |
| `ERR_ROOM_FULL` | No seats and queue disabled/full | `409` | Maybe |
| `ERR_QUEUE_FULL` | Waiting list has reached its configured limit | `409` | Maybe |
| `ERR_SEAT_TAKEN` | Seat already reserved or occupied | `409` | Maybe |
| `ERR_SEAT_LOCKED` | Seat change blocked during hand | `409` | No |
| `ERR_ALREADY_SEATED` | Session already owns a seat in the room | `409` | No |
| `ERR_JOIN_NAME_CONFLICT` | Nickname already active in room | `409` | Yes |
| `ERR_SPECTATOR_DISABLED` | Room does not allow spectator entry | `403` | No |

## Auth And Permissions
| Code | Meaning | HTTP | Retry |
| --- | --- | --- | --- |
| `ERR_AUTH_REQUIRED` | Missing or expired session | `401` | Yes |
| `ERR_OTP_INVALID` | OTP incorrect | `401` | Yes |
| `ERR_OTP_EXPIRED` | OTP no longer valid | `401` | Yes |
| `ERR_RATE_LIMITED` | Too many OTP or auth attempts | `429` | Yes |
| `ERR_FORBIDDEN` | Role lacks permission | `403` | No |

## Gameplay
| Code | Meaning | HTTP | Retry |
| --- | --- | --- | --- |
| `ERR_NOT_YOUR_TURN` | Intent from non-acting player | `409` | No |
| `ERR_ACTION_INVALID` | Action illegal in current state | `422` | Yes |
| `ERR_ACTION_TIMEOUT` | Turn expired before intent was accepted | `409` | Maybe |
| `ERR_STALE_SEQUENCE` | Client submitted outdated sequence | `409` | Yes |
| `ERR_INSUFFICIENT_STACK` | Amount exceeds live chips | `422` | Yes |
| `ERR_MIN_RAISE` | Raise smaller than legal minimum | `422` | Yes |

## Buy-In And Ledger
| Code | Meaning | HTTP | Retry |
| --- | --- | --- | --- |
| `ERR_MIN_BUYIN` | Amount below room minimum | `422` | Yes |
| `ERR_MAX_BUYIN` | Amount above room maximum | `422` | Yes |
| `ERR_TOPUP_DURING_HAND` | Top-up attempted while hand active | `409` | Later |
| `ERR_REBUY_DISABLED` | Room does not allow rebuy in current state | `409` | No |
| `ERR_LEDGER_COMMIT_FAILED` | Durable write failed | `503` | Maybe |

## Moderation And Room Admin
| Code | Meaning | HTTP | Retry |
| --- | --- | --- | --- |
| `ERR_ROOM_PAUSED` | Room is paused | `409` | Later |
| `ERR_CONFIG_EDIT_DURING_HAND` | Gameplay settings can only change between hands | `409` | Later |

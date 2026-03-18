# Realtime Events

## Client To Server Intents
| Event | Payload |
| --- | --- |
| `ROOM_SUBSCRIBE` | room id, session token |
| `ROOM_UNSUBSCRIBE` | room id |
| `PLAYER_READY` | room id, seat index |
| `PLAYER_SIT_OUT` | room id, effective timing |
| `ACTION_SUBMIT` | hand id, seq expectation, idempotency key, action type, amount |
| `CHAT_SEND` | room id, message |
| `REACTION_SEND` | room id, reaction type |
| `HISTORY_REQUEST` | hand id |

## Server To Client Events
| Event | Audience | Payload |
| --- | --- | --- |
| `ROOM_SNAPSHOT` | player/spectator | full current view |
| `ROOM_DIFF` | player/spectator | incremental public state changes |
| `PRIVATE_STATE` | owning player only | hole cards, private stack metadata, action affordances |
| `TURN_STARTED` | room | acting seat, deadline, legal action set |
| `TURN_WARNING` | room | acting seat, seconds remaining |
| `ACTION_ACCEPTED` | acting client | action seq, normalized amount |
| `ACTION_REJECTED` | acting client | error code, expected seq |
| `STREET_ADVANCED` | room | new street, board cards |
| `SHOWDOWN_RESULT` | room | hands shown, rankings, pot winners |
| `SETTLEMENT_POSTED` | room | ledger deltas, new stacks, odd chip markers |
| `ROOM_PAUSED` | room | reason, recovery guidance |
| `MODERATION_APPLIED` | room or target player | mute, kick, lock updates |

## Ordering Guarantees
- Every room message includes `roomEventNo`.
- Every hand-specific message includes `handId` and `handSeq`.
- Clients must ignore messages older than the latest acknowledged `roomEventNo`.
- Duplicate `ACTION_SUBMIT` events with the same idempotency key return the original result when possible.

## Visibility Rules
- Spectator payloads omit hole cards, private action affordances, and hidden deck metadata.
- Player payloads contain only the player's own hole cards plus public state.
- Admins do not receive hidden cards by role alone.

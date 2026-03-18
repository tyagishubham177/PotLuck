# Realtime Events

## Client To Server Intents
| Event | Payload |
| --- | --- |
| `ROOM_SUBSCRIBE` | room id, session token |
| `ROOM_UNSUBSCRIBE` | room id |
| `PLAYER_READY` | room id, seat index |
| `PLAYER_SIT_OUT` | room id, effective timing |
| `ACTION_SUBMIT` | hand id, seq expectation, idempotency key, action type, amount |
| `HISTORY_REQUEST` | hand id |

## Server To Client Events
| Event | Audience | Payload |
| --- | --- | --- |
| `ROOM_SNAPSHOT` | player/spectator | full current view |
| `ROOM_DIFF` | player/spectator | incremental public state changes |
| `PRIVATE_STATE` | owning player only | hole cards, private stack metadata, `actionAffordances`, reconnect metadata |
| `HAND_STARTED` | room | hand id, hand number, button, blind seats, action order seed data |
| `TURN_STARTED` | room | acting seat, deadline, legal action set |
| `TURN_WARNING` | room | acting seat, seconds remaining |
| `ACTION_ACCEPTED` | acting client | action seq, normalized amount |
| `ACTION_REJECTED` | acting client | error code, expected seq |
| `STREET_ADVANCED` | room | new street, board cards |
| `SHOWDOWN_RESULT` | room | hands shown, rankings, pot winners |
| `SETTLEMENT_POSTED` | room | ledger deltas, new stacks, odd chip markers |
| `PLAYER_DISCONNECTED` | room | seat index, disconnected at, timer impact summary |
| `PLAYER_RECONNECTED` | room | seat index, reconnected at |
| `QUEUE_UPDATE` | lobby viewers | queue entries, open seats, next eligible player |
| `ROOM_PAUSED` | room | reason, recovery guidance |
| `MODERATION_APPLIED` | room or target player | kick or lock updates |

## Ordering Guarantees
- Every room message includes `roomEventNo`.
- Every hand-specific message includes `handId` and `handSeq`.
- Clients must ignore messages older than the latest acknowledged `roomEventNo`.
- Duplicate `ACTION_SUBMIT` events with the same idempotency key return the original result when possible.

## Visibility Rules
- Spectator payloads omit hole cards, private action affordances, and hidden deck metadata.
- Player payloads contain only the player's own hole cards plus public state.
- Admins do not receive hidden cards by role alone.

## Private State Affordances
- `PRIVATE_STATE.actionAffordances` is an object, not a raw string list.
- It must include normalized fields such as `canFold`, `canCheck`, `callAmount`, `minRaiseTo`, `maxRaiseTo`, `allInAmount`, and `presetAmounts[]`.
- Clients should render only affordances that are explicitly present in the latest payload.

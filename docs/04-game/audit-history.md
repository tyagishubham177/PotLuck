# Audit And History

## Required Hand Transcript Fields
- Room id, hand id, hand number
- Timestamp boundaries
- Button, blind, and straddle seats
- Full action stream with sequence numbers and normalized amounts
- Street-by-street board reveal
- Contribution totals and per-street contributions
- Pot construction details and eligible winner sets
- Hand ranks at showdown
- Settlement records, odd-chip recipients, and resulting stacks

## Export Formats
| Format | Audience | Notes |
| --- | --- | --- |
| JSON | Support tools, automation, future replay | Full structured transcript |
| Text | Admin dispute review | Human-readable chronological summary |

## Audit Events
- `ROOM_CREATED`
- `ROOM_JOINED`
- `SEAT_RESERVED`
- `BUYIN_COMMITTED`
- `HAND_STARTED`
- `ACTION_COMMITTED`
- `TURN_TIMED_OUT`
- `HAND_SETTLED`
- `ROOM_CONFIG_CHANGED`
- `MODERATION_APPLIED`
- `ROOM_CLOSED`

## Access Control And Retention
- Hand history is visible only to room admins and participants in that room.
- Retention target is the current active session plus `30` days after room close.

## Finality Rules
- A hand becomes final only after settlement, ledger commit, and audit emission succeed.
- Corrections after finality must use compensating admin adjustments, never silent mutation of historical records.
- Exported transcripts should reference the adjustment if a post-hand correction ever occurs.

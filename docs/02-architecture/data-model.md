# Data Model

## Core Entities
| Entity | Key Fields |
| --- | --- |
| User | `id`, `email`, `authMethod`, `createdAt`, `isAdminCapable` |
| GuestSession | `id`, `roomId`, `nickname`, `signature`, `expiresAt`, `lastSeenAt`, `status` |
| WaitingListEntry | `id`, `roomId`, `guestSessionId`, `joinedAt`, `position`, `status` |
| Room | `id`, `code`, `name`, `status`, `adminUserId`, `maxSeats`, `config`, `maxDurationMinutes`, `closesAt`, `createdAt`, `updatedAt` |
| Seat | `id`, `roomId`, `seatIndex`, `occupantType`, `userId?`, `guestSessionId?`, `stack`, `sittingOut`, `reservedUntil`, `joinOrder` |
| Hand | `id`, `roomId`, `number`, `status`, `buttonSeatIndex`, `smallBlindSeatIndex`, `bigBlindSeatIndex`, `deckCommitHash`, `deckRevealHash`, `startedAt`, `endedAt` |
| Action | `id`, `handId`, `actorId`, `actorType`, `street`, `type`, `amount`, `seq`, `idempotencyKey`, `createdAt`, `resolution` |
| Pot | `id`, `handId`, `index`, `capLevel`, `eligiblePlayerIds[]`, `contributors[]`, `amount`, `rakeApplied` |
| Settlement | `id`, `handId`, `potId`, `winnerIds[]`, `splitAmounts[]`, `oddChipRecipientId?`, `createdAt` |
| LedgerEntry | `id`, `roomId`, `actorId`, `type`, `delta`, `balanceAfter`, `handId?`, `referenceId`, `createdAt` |
| AuditLog | `id`, `roomId`, `handId?`, `eventType`, `payloadJson`, `severity`, `createdAt` |

## Field Notes
- `User.authMethod`: v1 is `OTP_EMAIL` only. Multi-provider identity linking is deferred.
- `GuestSession.signature`: signed JWT or equivalent signed token bound to room id, nickname, and expiry.
- `Seat.occupantType`: enum values are `EMPTY`, `GUEST`, and `ADMIN`.
- `Action.resolution`: enum values are `ACCEPTED`, `AUTO_APPLIED`, `REJECTED_STALE`, `REJECTED_INVALID`, and `REJECTED_TIMEOUT`.
- `Pot.contributors[]`: array of `{ playerId, amount, contributionByStreet }` records used for replayable settlement display.

## Config Shape
- `stakes`: small blind, big blind, optional ante.
- `buyIn`: mode, min, max, rebuy enabled, top-up enabled.
- `rake`: enabled, percent, cap, mode.
- `visibility`: spectators allowed, training mode.
- `tableRules`: straddle allowed, odd chip rule, seat timeout, join expiry, sit-out auto-remove threshold.

## Derived Views
- Room lobby snapshot
- Public table state
- Private player overlay
- Hand transcript export
- Player balance summary per room

## Invariants
- A seat has at most one active occupant.
- Room code is unique among active rooms.
- Ledger entries are append-only; corrections are compensating entries.
- A hand's `seq` values are unique and gapless within the committed action stream.
- Settlement total plus rake equals contributed chips.
- No `ChatMessage` durable entity exists in v1 because chat is deferred from active scope.

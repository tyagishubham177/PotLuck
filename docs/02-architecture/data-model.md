# Data Model

## Core Entities
| Entity | Key Fields |
| --- | --- |
| User | `id`, `handle`, `avatarUrl`, `authIds`, `createdAt`, `trustFlags[]`, `isAdminCapable` |
| GuestSession | `id`, `roomId`, `nickname`, `signature`, `expiresAt`, `lastSeenAt`, `status` |
| Room | `id`, `code`, `name`, `status`, `adminUserId`, `maxSeats`, `config`, `createdAt`, `updatedAt` |
| Seat | `id`, `roomId`, `seatIndex`, `occupantType`, `userId?`, `guestSessionId?`, `stack`, `sittingOut`, `reservedUntil`, `joinOrder` |
| Hand | `id`, `roomId`, `number`, `status`, `buttonSeatIndex`, `smallBlindSeatIndex`, `bigBlindSeatIndex`, `deckCommitHash`, `deckRevealHash`, `startedAt`, `endedAt` |
| Action | `id`, `handId`, `actorId`, `actorType`, `street`, `type`, `amount`, `seq`, `idempotencyKey`, `createdAt`, `resolution` |
| Pot | `id`, `handId`, `index`, `capLevel`, `eligiblePlayerIds[]`, `contributors[]`, `amount`, `rakeApplied` |
| Settlement | `id`, `handId`, `potId`, `winnerIds[]`, `splitAmounts[]`, `oddChipRecipientId?`, `createdAt` |
| LedgerEntry | `id`, `roomId`, `actorId`, `type`, `delta`, `balanceAfter`, `handId?`, `referenceId`, `createdAt` |
| AuditLog | `id`, `roomId`, `handId?`, `eventType`, `payloadJson`, `severity`, `createdAt` |

## Config Shape
- `stakes`: small blind, big blind, optional ante.
- `buyIn`: mode, min, max, rebuy enabled, top-up enabled.
- `rake`: enabled, percent, cap, mode.
- `visibility`: spectators allowed, training mode, streamer delay seconds.
- `social`: chat allowed, emoji reactions enabled.
- `tableRules`: straddle allowed, odd chip rule, seat timeout, join expiry.

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

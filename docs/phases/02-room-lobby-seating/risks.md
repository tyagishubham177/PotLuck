# Phase 02: Room, Lobby, and Seating Risks

## Assumptions
- Room code generation excludes ambiguous characters.
- Queue length is modest in v1.

## Risks
- Seat race conditions if reservation writes are not serialized.
- Buy-in validation may need rework once ledger exists.

## Rollback Notes
- Room creation can be disabled while preserving auth.
- No hand state yet, so rollback is mostly CRUD-only.

## Deferred Work
- Actual buy-in ledger commit.
- Turn timers.
- Gameplay.

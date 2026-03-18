# Phase 03: Wallet, Buy-In, and Ledger Risks

## Assumptions
- Virtual chips have no cross-room transfer semantics.
- Derived balances can be recomputed from append-only history.

## Risks
- Double-spend style bugs if idempotency is weak.
- Future global wallet work may require additive abstraction.

## Rollback Notes
- Freeze buy-in endpoints and preserve read-only ledger data.
- Never delete ledger rows.

## Deferred Work
- Pot accounting.
- Action intents.
- Showdown.

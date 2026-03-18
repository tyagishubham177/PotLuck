# Phase 03: Wallet, Buy-In, and Ledger

## Objective
Implement room-scoped chips, buy-ins, rebuys, top-ups, and append-only ledger accounting.

## Why Now
Correct chip accounting must exist before game actions can move chips into pots.

## AI Mode
- Recommended mode: `hi`
- Comment: `hi`, leaning `xtra hi`; it is play-money, but ledger correctness, invariants, and rollback safety still need serious care.

## Prerequisites
- Phase 02 complete.
- Read `docs/02-architecture/data-model.md` and `docs/04-game/audit-history.md`.

## Touched Packages
- apps/server
- packages/contracts
- packages/config
- packages/test-kit

## Explicit Non-Goals
- Do not settle hands yet.
- Do not build full in-hand UI.

## Exit Criteria
- Buy-in, rebuy, and top-up rules are enforced.
- Ledger entries derive accurate per-room balances.

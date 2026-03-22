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
- Review the phase-owned target assets under `docs/phases/03-wallet-buyin-and-ledger/ui-targets/`.

## Touched Packages
- apps/server
- packages/contracts
- packages/config
- packages/test-kit

## Explicit Non-Goals
- Do not settle hands yet.
- Do not build full in-hand UI.

## UI Targets
| Screen | Assets | Target To Reach |
| --- | --- | --- |
| Seat reservation buy-in | `ui-targets/seat-reservation-buy-in/` | Buy-in amount selection as part of taking a seat, with min/max context, keypad, slider, and confirm action in the same flow. |
| Between-hands top-up | `ui-targets/between-hands-top-up/` | Restock overlay that keeps previous pot, average stack, timer, and current action context visible while the player adjusts chips. |

## Exit Criteria
- Buy-in, rebuy, and top-up rules are enforced.
- Ledger entries derive accurate per-room balances.

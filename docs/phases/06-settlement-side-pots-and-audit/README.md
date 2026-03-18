# Phase 06: Settlement, Side Pots, and Audit

## Objective
Implement pot construction, showdown evaluation per pot, odd-chip rules, rake, settlement writes, and exportable transcripts.

## Why Now
Fairness and correctness live or die here; this phase completes the money math.

## Prerequisites
- Phase 05 complete.
- Read `docs/04-game/settlement-spec.md` end to end.

## Touched Packages
- packages/game-engine
- apps/server
- packages/contracts
- packages/test-kit

## Explicit Non-Goals
- Do not build replay UI.
- Do not add real-money settlement or external payments.

## Exit Criteria
- Side pots resolve deterministically across multi-way all-ins.
- Ledger and audit trails are transactionally committed.

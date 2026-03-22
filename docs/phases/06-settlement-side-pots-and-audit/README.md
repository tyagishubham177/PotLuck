# Phase 06: Settlement, Side Pots, and Audit

## Objective
Implement pot construction, showdown evaluation per pot, odd-chip rules, rake, settlement writes, and exportable transcripts.

## Why Now
Fairness and correctness live or die here; this phase completes the money math.

## AI Mode
- Recommended mode: `xtra hi`
- Comment: `xtra hi`, and stay there; side pots, odd chips, rake, and transactional settlement are the highest-risk correctness area in the app.

## Prerequisites
- Phase 05 complete.
- Read `docs/04-game/settlement-spec.md` end to end.
- Review `docs/phases/06-settlement-side-pots-and-audit/ui.md` for the settlement reference screen.

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

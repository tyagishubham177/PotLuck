# Phase 05: Hold'em Engine and Hand State Risks

## Assumptions
- Hand evaluator library or implementation is deterministic and pure.
- Button rules match documented live-table behavior.

## Risks
- State explosion if engine and transport concerns mix.
- Min-raise edge cases can hide subtle bugs.

## Rollback Notes
- Keep engine package versioned separately inside the monorepo.
- Revert to paused room behavior if engine invariants fail.

## Deferred Work
- Pot settlement.
- Audit export polish.
- Final UI treatment.

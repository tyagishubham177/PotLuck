# Release Gates

## Required Before Production
- All phase acceptance criteria through Phase 09 are met.
- No open P0 or P1 settlement bugs.
- Golden scenario suite passes.
- Replay determinism and chip conservation properties pass.
- Manual UAT scripts complete with recorded outcomes.
- Alerting and dashboards are live.

## Required Before Public Beta Expansion
- Synthetic soak test at target room count passes.
- Recovery from server restart during active hand is demonstrated.
- Support workflow for dispute review is documented and tested.

## Evidence To Keep
- A saved soak report with action latency and reconnect outcomes.
- A metrics capture proving `/metrics` exposed action, settlement, room, and ledger signals.
- A restart rehearsal note showing the room resumed from a recovered `PAUSED` state.

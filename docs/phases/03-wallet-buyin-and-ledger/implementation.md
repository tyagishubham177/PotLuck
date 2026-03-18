# Phase 03: Wallet, Buy-In, and Ledger Implementation

## Sequence
1. Design ledger tables and balance derivation queries.
2. Implement buy-in, rebuy, and top-up APIs with table-stakes timing checks.
3. Add server-side rules for min/max buy-in and between-hand-only top-up.
4. Emit audit logs for every chip movement.
5. Create ledger unit tests and reconciliation checks.

## Keys and Inputs
### File Targets
- Keep using `apps/server/.env` and `apps/web/.env.local` from earlier phases.

### Needed from You
- No new external keys are required in this phase.
- The only dependency is the Phase 00 database access that is already in `apps/server/.env`.
- If the Neon dev database changes, update both `DATABASE_URL` and `DIRECT_DATABASE_URL` together so migrations and runtime stay aligned.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

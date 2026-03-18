# Phase 00: Foundation Risks

## Assumptions
- Managed dev Postgres is acceptable in early local setup.
- Optional managed Redis can stay out of scope until multi-instance coordination is needed.
- CI runs on GitHub Actions.

## Risks
- Tooling drift between web and server TS configs.
- Over-scaffolding too much before domain rules exist.

## Rollback Notes
- Revert scaffold-only changes and keep docs intact.
- Do not apply irreversible schema migrations in this phase.

## Deferred Work
- Database schema for real entities.
- Authentication flows.
- Realtime room logic.

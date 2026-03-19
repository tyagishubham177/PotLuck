# Deployment

## Production Targets
| Surface | Platform |
| --- | --- |
| Web | Vercel |
| Authoritative server | Fly.io |
| Database | Neon Postgres |
| Optional coordination cache | Upstash Redis later if needed |
| Email | Resend |
| Observability | Sentry + Grafana Cloud |

## Release Flow
1. Merge phase-scoped work to `master` after verification.
2. Deploy web preview automatically.
3. Deploy staging server and run smoke scripts.
4. Apply migrations with backward-safe rollout.
5. Promote server and web to production.
6. Watch alerts and room health before declaring release complete.

## Release Checklist
1. Confirm `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm --filter @potluck/test-kit test` all pass on the release branch.
2. Confirm local env files contain real Sentry and Grafana values while tracked `.env.example` files still contain placeholders only.
3. Run the synthetic soak flow and keep the report showing hands completed, reconnect success, and zero room pauses.
4. Hit `GET /metrics` in staging and confirm action latency, settlement latency, and room gauges are emitting.
5. Rehearse a restart recovery during an active hand and verify the room comes back paused until an admin resumes it.

## Rollback Rules
- Web-only UI regression: revert Vercel deployment first.
- Server regression with compatible schema: roll back Fly.io image.
- Schema incompatibility: keep old readers supported until forward fix ships; avoid destructive rollback.
- GitHub maintains daily `rollback-YYYY-MM-DD` tags on `master`; keep those tags usable for fast code rollback.

## Secret Ownership
- Web envs: public client config only.
- Server envs: DB URLs, mail key, signing keys, Sentry DSN, and optional Redis URL if enabled later.
- OTP and guest-session signing secrets rotate independently.

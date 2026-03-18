# Deployment

## Production Targets
| Surface | Platform |
| --- | --- |
| Web | Vercel |
| Authoritative server | Fly.io |
| Database | Neon Postgres |
| Cache and pub/sub | Upstash Redis |
| Email | Resend |
| Observability | Sentry + Grafana Cloud |

## Release Flow
1. Merge phase-scoped work to `master` after verification.
2. Deploy web preview automatically.
3. Deploy staging server and run smoke scripts.
4. Apply migrations with backward-safe rollout.
5. Promote server and web to production.
6. Watch alerts and room health before declaring release complete.

## Rollback Rules
- Web-only UI regression: revert Vercel deployment first.
- Server regression with compatible schema: roll back Fly.io image.
- Schema incompatibility: keep old readers supported until forward fix ships; avoid destructive rollback.
- GitHub maintains daily `rollback-YYYY-MM-DD` tags on `master`; keep those tags usable for fast code rollback.

## Secret Ownership
- Web envs: public client config only.
- Server envs: DB URLs, Redis URL, mail key, signing keys, Sentry DSN.
- OTP and guest-session signing secrets rotate independently.

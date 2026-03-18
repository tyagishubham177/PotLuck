# Phase 00: Foundation Implementation

## Sequence
1. Initialize `pnpm-workspace.yaml`, root `package.json`, and Turborepo pipeline.
2. Scaffold `apps/web` with Next.js and `apps/server` with Fastify.
3. Create empty but buildable shared packages with TS project references.
4. Add ESLint, Prettier if used, TypeScript config, Vitest, and CI workflow.
5. Create env schemas in `packages/config` and wire them into both apps.
6. Document local setup, scripts, and directory ownership in root README updates.

## Keys and Inputs
### File Targets
- Put real server values in `apps/server/.env` using `apps/server/.env.example` as the template.
- Put real web values in `apps/web/.env.local` using `apps/web/.env.example` as the template.

### Needed from You
| Variable(s) | Need in this phase | Site or source | Put the real value in | How to get it |
| --- | --- | --- | --- | --- |
| `DATABASE_URL`, `DIRECT_DATABASE_URL` | Yes | Neon | `apps/server/.env` | Create a dev database in Neon, open the connection details page, copy the pooled URL into `DATABASE_URL`, and copy the direct connection string into `DIRECT_DATABASE_URL`. |
| `SESSION_SIGNING_SECRET`, `GUEST_SESSION_SIGNING_SECRET`, `ADMIN_OTP_SIGNING_SECRET`, `COOKIE_SECRET` | Yes | Generate locally | `apps/server/.env` | Generate four separate 32-byte-plus random secrets with a password manager or a local generator; do not reuse the same value across variables. |
| `APP_ORIGIN`, `NEXT_PUBLIC_APP_ORIGIN`, `NEXT_PUBLIC_SERVER_ORIGIN` | Yes | Local machine values | `apps/server/.env` and `apps/web/.env.local` | Use your local dev URLs, normally `http://localhost:3001` for the server and `http://localhost:3000` for the web app. |

### Setup Steps
1. Copy `apps/server/.env.example` to `apps/server/.env`.
2. Copy `apps/web/.env.example` to `apps/web/.env.local`.
3. Replace the Phase 00 values listed above.
4. Leave later-phase placeholders on dummy values until that phase begins.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

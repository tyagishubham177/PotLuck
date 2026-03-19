# Web

Next.js application shell for PotLuck's player-facing client.

## Commands
- Dev: `pnpm --filter @potluck/web dev`
- Build: `pnpm --filter @potluck/web build`
- Test: `pnpm --filter @potluck/web test`

## Environment
- Copy `apps/web/.env.example` to `apps/web/.env.local`.
- Fill `NEXT_PUBLIC_SENTRY_DSN` locally if browser monitoring should be enabled for staging or beta.

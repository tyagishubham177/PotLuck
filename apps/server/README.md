# Server

Fastify application shell for PotLuck's authoritative backend.

## Commands
- Dev: `pnpm --filter @potluck/server dev`
- Build: `pnpm --filter @potluck/server build`
- Test: `pnpm --filter @potluck/server test`

## Operations
- Health: `GET /health` or `GET /api/health`
- Metrics: `GET /metrics`
- Restart recovery is rehearsed via state snapshot export/import tests that restore active hands as `PAUSED` until an admin resumes them.

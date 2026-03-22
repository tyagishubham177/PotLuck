# PotLuck

PotLuck is a docs-first monorepo for a realtime multiplayer poker app with an authoritative server, a mobile-first web client, room-scoped chips, and deterministic per-hand settlement.

## Current State
- Phases 00 through 09 are implemented in-repo.
- The workspace now includes the realtime server, mobile-first web client, deterministic Hold'em engine, moderation/history flows, and Phase 09 hardening helpers for recovery, soak testing, and release verification.
- The docs remain the authoritative source for product, architecture, ops, and release expectations.

## Stack
- Monorepo: `pnpm` + Turborepo
- Web: Next.js 15, React 19, TypeScript
- Server: Fastify, native WebSocket (`ws`), Zod, Drizzle ORM
- Shared: workspace packages for contracts, config, UI, game-engine, and test helpers
- Tooling: ESLint, TypeScript, Vitest, GitHub Actions CI

## Repo Layout
- `docs/`: authoritative specs and phased implementation packs
- `apps/web/`: Next.js client shell for the player-facing web app
- `apps/server/`: Fastify server shell for HTTP and future realtime authority
- `packages/contracts/`: shared Zod contracts and DTOs
- `packages/game-engine/`: deterministic poker engine placeholders
- `packages/ui/`: shared React UI primitives
- `packages/config/`: runtime env validation for web and server
- `packages/test-kit/`: fixtures and test helpers for later phases

## Local Setup
1. Install Node.js `22.x`.
2. Enable Corepack with `corepack enable`.
3. Install dependencies with `corepack pnpm install`.
4. Copy `apps/server/.env.example` to `apps/server/.env`.
5. Copy `apps/web/.env.example` to `apps/web/.env.local`.
6. Replace the placeholder database, session-secret, and email values in `apps/server/.env` before using auth or room flows.
7. Leave the observability placeholders in place, or add real Sentry and Grafana values later when you want local monitoring.
8. Start both apps with `corepack pnpm dev:resilient`.

## Recommended Local Run
Use the resilient runner from the repo root:

```powershell
corepack pnpm dev:resilient
```

It will:
- create missing local env files from the checked-in examples
- install dependencies unless you pass `-SkipInstall`
- reuse healthy PotLuck dev servers already running on ports `3000` and `3001`
- automatically clear conflicting processes on those ports when they are not serving the expected health endpoints

Stop both local dev processes later with:

```powershell
corepack pnpm dev:stop
```

## Environment Files
- Server secrets live in `apps/server/.env`.
- Web local values live in `apps/web/.env.local`.
- Example templates live beside them as `.env.example`.

## Workspace Commands
- Start everything with the resilient local runner: `corepack pnpm dev:resilient`
- Start everything with Turborepo only: `corepack pnpm dev`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Build: `pnpm build`
- Test-kit only: `pnpm --filter @potluck/test-kit test`

## Read This In Order
1. `docs/README.md`
2. `docs/00-overview.md`
3. `docs/02-architecture/system-overview.md`
4. `docs/04-game/settlement-spec.md`
5. `docs/phases/09-hardening-load-release/README.md`

## Quick Verification
- `git status --short --branch`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @potluck/test-kit test`
- `pnpm build`

## Phase 09 Ops Checks
- Server metrics endpoint: `http://localhost:3001/metrics`
- Recovery rehearsal: export a state snapshot in tests and verify the room resumes from `PAUSED`
- Synthetic soak coverage: see the realtime/server tests that run `runSyntheticRoomSoak(...)`

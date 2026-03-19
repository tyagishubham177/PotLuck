# PotLuck

PotLuck is a docs-first monorepo for a realtime multiplayer poker app with an authoritative server, a mobile-first web client, room-scoped chips, and deterministic per-hand settlement.

## Current State
- Phase 00 foundation is scaffolded.
- The repo now contains the baseline monorepo, local env wiring, CI, and placeholder apps/packages.
- Later phases should build on this foundation in order from `docs/phases/00-foundation/` onward.

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
3. Install dependencies with `pnpm install`.
4. Start both apps with `pnpm dev`.

## Environment Files
- Server secrets live in `apps/server/.env`.
- Web local values live in `apps/web/.env.local`.
- Example templates live beside them as `.env.example`.

## Workspace Commands
- Start everything: `pnpm dev`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Build: `pnpm build`

## Read This In Order
1. `docs/README.md`
2. `docs/00-overview.md`
3. `docs/02-architecture/system-overview.md`
4. `docs/04-game/settlement-spec.md`
5. `docs/phases/00-foundation/README.md`

## Quick Verification
- `git status --short --branch`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

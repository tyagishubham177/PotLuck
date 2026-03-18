# PotLuck

PotLuck is a docs-first blueprint for a realtime multiplayer poker app with an authoritative server, mobile-first web UI, room-based play, room-scoped chips, and deterministic per-hand settlement.

## Current State
- The repo currently contains the full implementation pack and phased execution docs.
- Code scaffolding has not started yet.
- The next implementation step is `docs/phases/00-foundation/`.

## Planned Stack
- Monorepo: `pnpm` + Turborepo
- Web: Next.js 15, React 19, TypeScript, Tailwind CSS 4, Radix UI, Framer Motion, TanStack Query
- Server: Node 22, Fastify, Socket.IO, Zod, Drizzle ORM
- Data: Neon Postgres, Upstash Redis
- Infra: Vercel, Fly.io, Resend, Sentry, OpenTelemetry, Grafana Cloud

## Repo Layout
- `docs/`: authoritative specs and phased implementation packs
- `apps/web/`: future Next.js client
- `apps/server/`: future authoritative realtime server
- `packages/contracts/`: shared contracts and error types
- `packages/game-engine/`: deterministic rules and settlement engine
- `packages/ui/`: shared components and design tokens
- `packages/config/`: env validation and runtime config
- `packages/test-kit/`: fixtures, bots, replay helpers

## Read This In Order
1. `docs/README.md`
2. `docs/00-overview.md`
3. `docs/02-architecture/system-overview.md`
4. `docs/04-game/settlement-spec.md`
5. `docs/phases/00-foundation/README.md`

## Verification
- `git status --short --branch`
- `Get-ChildItem docs -Recurse`
- `git diff --stat`

# PotLuck Agent Guide

## Purpose
- This repo is docs-first right now. Treat `docs/` as the source of truth until Phase 00 scaffolding is complete.
- Durable design decisions live in `docs/01-*` through `docs/07-*`.
- Execution detail lives in `docs/phases/`.

## Repo Map
- `docs/README.md`: master index and reading order.
- `docs/phases/`: numbered implementation packs. Build in order.
- `apps/web`: reserved for the Next.js client.
- `apps/server`: reserved for the Fastify + Socket.IO authoritative server.
- `packages/contracts`: shared Zod schemas, error codes, and DTOs.
- `packages/game-engine`: deterministic poker rules and settlement logic.
- `packages/ui`: shared UI and design tokens.
- `packages/config`: runtime config and env validation.
- `packages/test-kit`: fixtures, bots, replay helpers, and property tests.

## Working Rules
- Start each new task on a new `codex/*` branch.
- Pull the latest `master` before branching when practical.
- Read the relevant phase pack before editing code.
- Do not implement a later phase early unless the active phase explicitly requires a seam.
- Keep poker rules inside `packages/game-engine` and contracts inside `packages/contracts`.
- Every important flow must define source of truth, timeout behavior, retries/idempotency, audit trail, and verification steps.

## Current Commands
- Repo verification:
  - `git status --short --branch`
  - `Get-ChildItem docs -Recurse`
  - `git diff --stat`
- Target commands after Phase 00:
  - `pnpm install`
  - `pnpm dev`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`

## Delivery Rhythm
- Use `docs/phases/_template/` when adding or reshaping phases.
- Each phase folder must contain `README.md`, `implementation.md`, `contracts.md`, `verification.md`, and `risks.md`.
- When a decision becomes durable, move it from a phase doc into the appropriate authoritative doc or ADR.

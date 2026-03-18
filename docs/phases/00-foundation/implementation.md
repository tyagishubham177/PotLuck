# Phase 00: Foundation Implementation

## Sequence
1. Initialize `pnpm-workspace.yaml`, root `package.json`, and Turborepo pipeline.
2. Scaffold `apps/web` with Next.js and `apps/server` with Fastify.
3. Create empty but buildable shared packages with TS project references.
4. Add ESLint, Prettier if used, TypeScript config, Vitest, and CI workflow.
5. Create env schemas in `packages/config` and wire them into both apps.
6. Document local setup, scripts, and directory ownership in root README updates.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

# Phase 00: Foundation

## Objective
Create the monorepo scaffold, package boundaries, baseline CI, env handling, and local developer workflow.

## Why Now
Every later phase depends on stable workspace tooling, shared contracts, and repeatable verification commands.

## AI Mode
- Recommended mode: `med`
- Comment: `med`, leaning `hi`; use `hi` if the agent is scaffolding the whole monorepo, CI, and env validation in one pass.

## Prerequisites
- Read `docs/README.md` and `docs/02-architecture/system-overview.md`.
- Lock the package boundaries from `README.md` and `AGENTS.md`.

## Touched Packages
- apps/web
- apps/server
- packages/contracts
- packages/game-engine
- packages/ui
- packages/config
- packages/test-kit

## Explicit Non-Goals
- Do not implement poker logic beyond trivial placeholders.
- Do not add room APIs or websocket game flow yet.

## Exit Criteria
- Workspace installs cleanly.
- Root scripts for lint, typecheck, test, and build exist.
- CI runs the baseline pipeline.
- Env validation exists for both apps.

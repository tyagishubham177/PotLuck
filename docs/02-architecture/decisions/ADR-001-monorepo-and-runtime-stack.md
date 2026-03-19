# ADR-001: Monorepo And Runtime Stack

## Status
Accepted

## Decision
Use a TypeScript monorepo with `pnpm` and Turborepo, with Next.js for the web app, Fastify + native WebSocket (`ws`) for the server transport, Zod for contracts, Drizzle ORM for persistence, and managed Postgres as the required hosted data layer. Redis remains optional for later coordination needs, not a v1 requirement.

## Why
- Keeps contracts, engine logic, and UI types aligned.
- Matches AI-assisted implementation well because boundaries are explicit.
- Minimizes translation cost between server, client, and test harnesses.
- Supports a cloud-first deployment model without forcing local infrastructure beyond Postgres.

## Consequences
- Package boundaries must be respected from the start.
- Shared types must come from `packages/contracts`, not ad hoc copies.
- Room actors must remain process-authoritative even if future scaling adds routing layers.

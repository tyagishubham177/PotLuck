# Phase 00: Foundation Verification

## Run Commands
1. Install Node.js `22.x`.
2. Enable Corepack:
   `corepack enable`
3. Install workspace dependencies:
   `corepack pnpm install`
4. Run lint:
   `corepack pnpm lint`
5. Run TypeScript checks:
   `corepack pnpm typecheck`
6. Run tests:
   `corepack pnpm test`
7. Build every workspace:
   `corepack pnpm build`
8. Start local development servers:
   `corepack pnpm dev`

## Manual Checks
- Open `http://localhost:3000` and confirm the PotLuck foundation shell loads.
- Confirm the page shows the local app origin, local server origin, and `foundation-ready` status.
- Open `http://localhost:3001/health` and confirm the server returns an `ok` health payload.
- Temporarily break one required value in `apps/server/.env`, start the server again, and confirm startup fails with a readable env validation error.

## Failure Cases
- Missing env file prevents startup.
- A package import that crosses boundaries without exports fails typecheck.
- Running with the wrong Node major version should be corrected before trusting local results.

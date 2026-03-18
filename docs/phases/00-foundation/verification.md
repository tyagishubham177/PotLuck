# Phase 00: Foundation Verification

## Run Commands
- pnpm install
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- pnpm dev

## Manual Checks
- Web app boots with placeholder shell.
- Server boots and exposes health endpoint.
- Intentional invalid env var fails fast with readable error.

## Failure Cases
- Missing env file prevents startup.
- A package import that crosses boundaries without exports fails typecheck.

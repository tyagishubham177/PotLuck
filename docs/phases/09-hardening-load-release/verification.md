# Phase 09: Hardening, Load, and Release Verification

## Run Commands
- pnpm test
- pnpm lint
- pnpm typecheck
- pnpm build
- pnpm --filter test-kit test

## Manual Checks
- Server restart during active hand recovers or pauses safely.
- Release checklist is completed with evidence.
- Alerts fire in staging during synthetic fault injection.

## Failure Cases
- Action latency regression blocks release.
- Any settlement mismatch blocks release.

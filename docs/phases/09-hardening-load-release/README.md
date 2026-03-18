# Phase 09: Hardening, Load, and Release

## Objective
Prove reliability, performance, accessibility, and release readiness under realistic private-beta load.

## Why Now
The app should not be called production-ready until restart recovery, load behavior, and operational workflows are exercised.

## AI Mode
- Recommended mode: `hi`
- Comment: `hi`, leaning `xtra hi`; the code changes are smaller, but soak tests, alerts, and release decisions carry high operational risk.

## Prerequisites
- Phases 00 through 08 complete.
- Read `docs/07-quality/test-strategy.md` and `docs/06-ops/observability.md`.

## Touched Packages
- apps/web
- apps/server
- packages/test-kit
- packages/game-engine
- packages/contracts

## Explicit Non-Goals
- Do not add net-new user-facing features.
- Do not widen scope into tournaments or multi-region launch.

## Exit Criteria
- Release gates pass.
- Dashboards and alerts are live.
- Recovery and soak tests are documented and repeatable.

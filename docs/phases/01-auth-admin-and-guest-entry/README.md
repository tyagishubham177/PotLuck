# Phase 01: Auth, Admin, and Guest Entry

## Objective
Implement verified admin creation flow and low-friction guest room join sessions.

## Why Now
Room creation and room-code entry are the front door for every other interaction.

## AI Mode
- Recommended mode: `hi`
- Comment: `hi`, leaning `med`, but safe-side `hi` because auth, rate limits, cookies, and signed sessions are security-sensitive.

## Prerequisites
- Phase 00 complete.
- Read `docs/03-contracts/rest-api.md` and `docs/01-product/user-flows.md`.

## Touched Packages
- apps/web
- apps/server
- packages/contracts
- packages/config

## Explicit Non-Goals
- Do not implement seating or buy-in commits yet.
- Do not add spectator UI beyond join-mode plumbing.

## Exit Criteria
- Admin can request and verify OTP.
- Guest can join by room code and nickname.
- Role-aware sessions are signed and validated.

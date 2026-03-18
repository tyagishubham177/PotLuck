# Phase 05: Hold'em Engine and Hand State

## Objective
Build the deterministic hand lifecycle, action legality, blinds, betting rounds, dealing, and showdown triggers.

## Why Now
This phase turns the room actor into a playable poker table, but without final settlement complexity yet.

## Prerequisites
- Phase 04 complete.
- Read `docs/04-game/hold-em-rules.md` and `docs/02-architecture/state-machines.md`.

## Touched Packages
- packages/game-engine
- packages/contracts
- apps/server
- packages/test-kit

## Explicit Non-Goals
- Do not finalize side-pot payout logic in this phase.
- Do not ship polished end-user table visuals yet.

## Exit Criteria
- A full hand can progress from blinds to showdown deterministically.
- Action legality and turn order are enforced server-side.

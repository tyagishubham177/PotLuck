# Phase 02: Room, Lobby, and Seating

## Objective
Build room creation, room code lifecycle, lobby snapshots, seat reservation, waiting list, and buy-in quoting.

## Why Now
Players need a stable pre-hand environment before any chip or game actions exist.

## AI Mode
- Recommended mode: `med`
- Comment: `med`, leaning `hi`; there are several stateful UX flows here, but the logic is still simpler than realtime gameplay.

## Prerequisites
- Phases 00 and 01 complete.
- Read `docs/01-product/room-rules.md` and `docs/05-experience/screen-specs.md`.

## Touched Packages
- apps/web
- apps/server
- packages/contracts
- packages/config

## Explicit Non-Goals
- Do not debit or credit live chip ledgers yet.
- Do not start hands automatically yet.

## Exit Criteria
- Admin can create a room.
- Guests can see lobby, reserve seats, queue, and receive min/max buy-in quotes.

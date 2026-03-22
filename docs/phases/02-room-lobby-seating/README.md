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
- Review the phase-owned target assets under `docs/phases/02-room-lobby-seating/ui-targets/`.

## Touched Packages
- apps/web
- apps/server
- packages/contracts
- packages/config

## Explicit Non-Goals
- Do not debit or credit live chip ledgers yet.
- Do not start hands automatically yet.

## UI Targets
| Screen | Assets | Target To Reach |
| --- | --- | --- |
| Create room table basics | `ui-targets/create-room-table-basics/` | Step-based table setup with seat count, blinds, ante, and a side panel that previews derived buy-in logic. |
| Create room rules and access | `ui-targets/create-room-rules-and-access/` | Spectator toggle, waiting-list toggle, buy-in range, join-code expiry, and gameplay options in one calm control surface. |
| Create room review and launch | `ui-targets/create-room-review-and-launch/` | Final summary of room metadata, rules, and derived values before create. |
| Room created share | `ui-targets/room-created-share/` | Share-ready room code, QR path, blinds, buy-in range, and a clear `Enter Lobby` handoff. |
| Lobby seat picker | `ui-targets/lobby-seat-picker/` | Waiting room roster, center seat map, rules side panel, and clear ready/start expectations. |
| Waiting list full room | `ui-targets/waiting-list-full-room/` | Queue position, estimated wait, and spectator fallback when the room is full. |

## Exit Criteria
- Admin can create a room.
- Guests can see lobby, reserve seats, queue, and receive min/max buy-in quotes.

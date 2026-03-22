# PotLuck Overview

## Product Shape
- PotLuck is a room-based realtime poker web app for private friend groups.
- Primary game: Texas Hold'em, no-limit, 2 to 9 seats.
- v1 is play-money only with room-scoped chips and no global wallet.
- Mobile and desktop are equal primary targets, sharing the same product scope and information architecture.

## Goals
- Make table creation and joining friction-light.
- Keep all game authority, randomness, timers, and settlement on the server.
- Produce deterministic, auditable hand outcomes with correct side pots and odd-chip handling.
- Close each room with a clear session summary and optional settle-up derived from a chip-to-dollar ratio.
- Keep the architecture legible enough that future AI agents can implement phase by phase without product drift.

## Non-Goals
- Tournaments
- Real-money payments or withdrawals
- Run-it-twice
- Hand replay viewer in v1
- Multi-variant support beyond Texas Hold'em
- Global matchmaking or discovery
- Spectator system in v1
- Waiting list in v1

## Launch Defaults
| Area | Default |
| --- | --- |
| Audience | Private friend groups |
| Auth | Password-protected admin, guest players |
| Spectators | Deferred to post-v1 |
| Odd chip rule | Left of button |
| Session max duration | 10 hours by default |
| Session summary and settle-up | Enabled at room close |
| Region | Single primary region |
| Hosting | Vercel + Fly.io + Neon + optional Redis later |

## Core Roles
| Role | Capabilities |
| --- | --- |
| Admin | Create room, edit config between hands, pause/resume, remove disruptive players, export history |
| Player | Join by code, seat, buy in, act in hand, top up between hands |
| Moderator | Same as admin for the room in v1 |

## Core Invariants
- Server is the only writer of authoritative room and hand state.
- Clients submit intents, never state mutations.
- Every chip movement produces append-only ledger and audit records.
- A player's stack for a hand is fixed once cards are dealt.
- Folded players can contribute to pots but cannot win them.
- All contract payloads are versioned and validated at boundaries.

## Planned Stack
| Layer | Choice | Reason |
| --- | --- | --- |
| Package manager | pnpm | Fast workspace installs and predictable monorepo behavior |
| Task runner | Turborepo | Clear package graphs and cached CI steps |
| Web | Next.js 15 | Mature web app framework and easy Vercel deploy |
| UI | Tailwind CSS 4 + Radix + Framer Motion, optional Rive later | Framer Motion covers layout and UI transitions; Rive can be added later if table-state animation needs a dedicated vector runtime |
| Realtime server | Fastify + native WebSocket (`ws`) | Thin transport, browser-native clients, and straightforward room-event ordering in single-process v1 |
| Shared validation | Zod | Runtime validation and inferred types |
| Persistence | Drizzle + Neon Postgres | Typed schema control with low-cost managed Postgres |
| Coordination | In-process room actors, optional Redis later | Single-process v1 is sufficient for 1 to 2 concurrent rooms |
| Observability | Sentry + structured JSON logging | Error tracking with lightweight operational visibility |

## Document Map
- `glossary.md`: shared project terminology and cross-doc vocabulary
- `01-product/`: room rules, player lifecycle, feature boundaries, journey specs
- `02-architecture/`: topology, actors, state machines, data model, ADRs
- `03-contracts/`: REST, realtime, errors
- `04-game/`: rules, settlement, RNG, audit behavior
- `05-experience/`: design system, screens, accessibility, copy
- `06-ops/`: environments, deployment, observability, incidents
- `07-quality/`: automated and manual verification
- `phases/`: execution packs for implementation

## Delivery Principles
- Prefer pure deterministic domain code over framework-coupled logic.
- Keep a single writer per room to avoid race conditions.
- Design every phase to be independently testable and reviewable.
- Move stable decisions out of phase docs and into authoritative docs as soon as they are fixed.

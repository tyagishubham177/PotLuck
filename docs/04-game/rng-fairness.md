# RNG And Fairness

## Shuffle Rules
- Use a cryptographically secure random source on the server.
- Build a canonical ordered 52-card deck before every hand.
- Apply Fisher-Yates shuffle using server-generated randomness only.
- Never expose shuffle seeds or deck order to clients before hand finality.

## Audit Commitments
- Generate a per-hand secret seed.
- Derive the shuffled deck and compute a pre-hand commitment hash.
- Persist the commitment hash before any player receives cards.
- After the hand closes, persist a reveal artifact or deck-order hash suitable for dispute review without leaking future-hand entropy.

## Fairness Controls
- Clients never shuffle, deal, or evaluate winners.
- Spectators receive only public board and showdown-exposed private cards.
- Training mode that reveals hole cards must be a room-level explicit opt-in and visually obvious.
- Streamer delay, if enabled, applies only to spectator/public feeds and not to seated players.

## v1 Collusion Signals
- VPIP/PFR divergence against one repeated opponent.
- Unusual fold-to-bet rates when a specific player is aggressor.
- Repeated soft-play patterns in heads-up all-in eligible spots.
- Suspicion flags are informational only in v1 and must not auto-penalize users.

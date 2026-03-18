# RNG And Fairness

## Shuffle Rules
- Use Node.js `crypto.randomBytes` as the server-side CSPRNG source.
- Build a canonical ordered 52-card deck before every hand.
- Canonical card encoding is rank plus suit string, for example `2h`, `As`, and `Td`.
- Apply Fisher-Yates shuffle using server-generated randomness only.
- Never expose shuffle seeds or deck order to clients before hand finality.

## Audit Commitments
- Generate a per-hand secret seed.
- Derive the shuffled deck and compute a pre-hand commitment hash.
- Persist the commitment hash before any player receives cards.
- Commit-reveal scope in v1 is limited to the finished hand only.
- After the hand closes, persist a reveal artifact or deck-order hash suitable for dispute review without leaking future-hand entropy.

## Fairness Controls
- Clients never shuffle, deal, or evaluate winners.
- Spectators receive only public board and showdown-exposed private cards.
- Training mode that reveals hole cards must be a room-level explicit opt-in and visually obvious.

## Future / Nice To Have
- Streamer delay for spectator/public feeds only.
- Collusion signal dashboards such as VPIP/PFR divergence against repeated opponents.
- Informational suspicion flags only; no automatic penalties.

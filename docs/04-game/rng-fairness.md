# RNG And Fairness

## Shuffle Rules
- Use Node.js `crypto.randomBytes` as the server-side CSPRNG source.
- Build a canonical ordered 52-card deck before every hand.
- Canonical card encoding is rank plus suit string, for example `2h`, `As`, and `Td`.
- Apply Fisher-Yates shuffle using server-generated randomness only.
- Never expose shuffle seeds or deck order to clients before hand finality.

## Fairness Controls
- Clients never shuffle, deal, or evaluate winners.
- Randomness generation stays server-side and uses the platform CSPRNG directly in v1.
- Commit-reveal verification is intentionally deferred until a later fairness hardening pass.

## Future / Nice To Have
- Commitment hash and reveal artifact workflow for dispute verification.
- Streamer delay for future spectator or public feeds only.
- Collusion signal dashboards such as VPIP/PFR divergence against repeated opponents.
- Informational suspicion flags only; no automatic penalties.

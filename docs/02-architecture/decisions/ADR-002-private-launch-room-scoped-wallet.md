# ADR-002: Private Launch And Room-Scoped Wallet

## Status
Accepted

## Decision
Launch v1 for private friend groups with verified admins, guest players, and room-scoped virtual chips.

## Why
- Minimizes onboarding friction for casual play.
- Avoids global wallet abuse, transfer semantics, and cross-room accounting complexity.
- Keeps moderation and recovery manageable for an early production release.

## Consequences
- A player's bankroll is tracked independently per room.
- Guest identity is sufficient for table play but not for admin powers.
- Future global wallet work will be additive, not assumed in v1 APIs.

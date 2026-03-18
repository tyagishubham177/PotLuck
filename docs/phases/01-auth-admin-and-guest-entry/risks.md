# Phase 01: Auth, Admin, and Guest Entry Risks

## Assumptions
- OTP email delivery can use sandbox mode in non-prod.
- Guest identity is room-scoped only.

## Risks
- Email provider failures can block room creation.
- Token shape may expand in later moderation phases.

## Rollback Notes
- Disable OTP endpoint and guest join route if unstable.
- No chip-affecting state should exist yet.

## Deferred Work
- Seat reservation.
- Waiting list.
- Buy-in logic.

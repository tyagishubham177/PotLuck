# Phase 01: Auth, Admin, and Guest Entry Implementation

## Sequence
1. Add admin auth endpoints and email OTP delivery adapter.
2. Add guest session creation using room code plus nickname uniqueness checks.
3. Implement signed session tokens for admin and room-scoped guests.
4. Build create-room auth gate and join-by-code screen states.
5. Log auth and join audit events.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

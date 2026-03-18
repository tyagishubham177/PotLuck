# Phase 01: Auth, Admin, and Guest Entry Implementation

## Sequence
1. Add admin auth endpoints and email OTP delivery adapter.
2. Add guest session creation using room code plus nickname uniqueness checks.
3. Implement signed session tokens for admin and room-scoped guests.
4. Build create-room auth gate and join-by-code screen states.
5. Log auth and join audit events.

## Keys and Inputs
### File Targets
- Put real server values in `apps/server/.env` using `apps/server/.env.example` as the template.
- Reuse the Phase 00 web file `apps/web/.env.local` only if the auth flow needs public origin changes.

### Needed from You
| Variable(s) | Need in this phase | Site or source | Put the real value in | How to get it |
| --- | --- | --- | --- | --- |
| `RESEND_API_KEY` | Yes | Resend | `apps/server/.env` | Create a Resend account, open API Keys, create a backend key for the server, and paste it into this variable. |
| `RESEND_FROM_EMAIL` | Yes | Resend verified sender or sandbox sender | `apps/server/.env` | Verify a sender email or domain in Resend, then paste the exact approved sender address here. Sandbox mode is fine for non-prod work. |

### Setup Steps
1. Open [Resend](https://resend.com/) and create the API key.
2. Verify a sender email or domain, or use the sandbox sender while we are still in development.
3. Replace the Phase 01 placeholders in `apps/server/.env`.
4. Keep the Phase 00 signing secrets from the previous phase; do not rotate them casually during active auth work.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

# Observability

## Error Tracking
- Use Sentry for application errors, unhandled exceptions, and high-signal failure breadcrumbs.
- Tag Sentry events with room id, hand id, and actor id when available.
- Settlement failures and ledger mismatches should open the clearest possible Sentry issue trail.

## Logging
- Structured JSON logs from server only.
- Include room id, hand id, player id, event number, and trace id where available.
- Never log hidden cards in general operational logs.
- Hidden-card audit artifacts live in protected support-access storage only.

## Health Signals
- Keep a lightweight health endpoint for deployment checks and uptime monitoring.
- Use structured logs to confirm room creation, settlement, reconnect, and room-close summary flows during manual verification.
- Escalate any repeated settlement or ledger inconsistencies even if the room appears otherwise healthy.

## Alerts
- Settlement failure > 0 in any 5-minute window.
- Ledger balance mismatch > 0 in any 5-minute window.

# Runbook

## Common Incidents
| Incident | First Action |
| --- | --- |
| Stuck hand | pause room, inspect latest hand seq, compare persisted events to actor state |
| Settlement failure | prevent next hand, inspect DB transaction logs, replay hand in support tool |
| Optional Redis outage | keep current rooms alive and verify no optional presence features are degraded |
| Postgres latency spike | slow new room creation, monitor failed writes, consider temporary room cap |
| OTP mail outage | disable new admin room creation, preserve existing sessions |

## Manual Recovery
1. Identify room and active hand id.
2. Export last persisted hand transcript.
3. Reconstruct state in support replay tooling.
4. If deterministic replay matches, resume room.
5. If not, keep room paused and use compensating admin adjustments after review.

## Alert Thresholds
- P95 settlement > 1 second.
- More than 3 recovery pauses in 30 minutes.
- More than 5 percent websocket reconnect failures in 15 minutes.
- Any ledger commit mismatch.

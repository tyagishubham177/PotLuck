# Observability

## Metrics
| Metric | Why |
| --- | --- |
| active rooms | capacity planning |
| seated players | usage tracking |
| hands per hour | throughput |
| action ack latency | realtime health |
| settlement duration | correctness and performance |
| reconnect success rate | reliability |
| timeout rate | UX quality |
| paused room count | operational risk |
| duplicate intent rejection count | client/network stability |

## Logging
- Structured JSON logs from server only.
- Include room id, hand id, player id, event number, and trace id where available.
- Never log hidden cards in general operational logs.
- Hidden-card audit artifacts live in protected support-access storage only.

## Tracing
- Trace create-room, join-room, action-submit, settlement, export generation, and reconnect flows.
- Carry correlation ids from HTTP upgrade through websocket session where possible.

## Alerts
- Settlement failure > 0 in any 5-minute window.
- P95 action acknowledgement latency > 300 ms for 10 minutes.
- Reconnect success < 95 percent in 15 minutes.
- Room pauses caused by recovery faults > threshold.

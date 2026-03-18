# Phase 09: Hardening, Load, and Release Implementation

## Sequence
1. Build synthetic player and room soak tools.
2. Run latency, reconnect, and restart chaos tests.
3. Complete accessibility audit and mobile/tablet regression pass.
4. Finalize deployment docs, rollback steps, and release checklist.
5. Record production beta support workflow for disputes and incidents.

## Keys and Inputs
### File Targets
- Put server-side observability values in `apps/server/.env` using `apps/server/.env.example` as the template.
- Put browser monitoring values in `apps/web/.env.local` using `apps/web/.env.example` as the template.

### Needed from You
| Variable(s) | Need in this phase | Site or source | Put the real value in | How to get it |
| --- | --- | --- | --- | --- |
| `SENTRY_DSN` | Yes | Sentry | `apps/server/.env` | Create the PotLuck server project in Sentry and copy the DSN from Project Settings. |
| `NEXT_PUBLIC_SENTRY_DSN` | Yes if browser errors should be tracked | Sentry | `apps/web/.env.local` | Create or reuse the browser-side Sentry project and copy its DSN into the web env file. |
| `SENTRY_AUTH_TOKEN` | Recommended | Sentry | `apps/server/.env` for local use, then CI secret storage later | Create an auth token with project release permissions so source maps and releases can be uploaded safely. |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | Yes if Grafana Cloud is the telemetry sink | Grafana Cloud | `apps/server/.env` | Create a Grafana Cloud stack, open OTLP ingestion, copy the endpoint URL, and copy the auth header string or token format they provide. |

### Setup Steps
1. Create the Sentry project or projects and replace the Sentry placeholders in the server and web env files.
2. Create the Grafana Cloud OTLP credentials and replace the telemetry placeholders in `apps/server/.env`.
3. Keep deployment-platform tokens out of app env files where possible; once CI exists, move release-only secrets into the CI secret store instead of committing new files.
4. Re-run smoke checks after every secret change so DSN or OTLP mistakes do not get mistaken for application bugs.

## Guardrails
- Keep scope inside this phase unless a documented seam is needed.
- Update authoritative docs if implementation discovers a durable design change.
- Add tests at the same time as core behavior, not after.

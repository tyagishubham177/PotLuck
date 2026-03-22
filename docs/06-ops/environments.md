# Environments

## Local
- Single developer machine.
- One web process and one server process.
- Managed dev Postgres is preferred to avoid heavy local ops.
- Optional managed Redis is acceptable only if later coordination experiments need it.
- Seed script creates sample room configs and test users.

## Staging
- Mirrors prod topology.
- Uses synthetic players for core multiplayer smoke tests.
- Hand history retention can be shorter.
- Session summary and settle-up flows should be enabled for QA.

## Production
- Single primary region.
- Friend-group usage assumptions, but public internet exposure.
- Tight alerting on reconnect rate, action timeout spikes, and settlement failures.

## Config Classes
- Build-time: public web flags and analytics ids.
- Runtime: blinds defaults, timer defaults, feature flags, observability endpoints.
- Secret: session signing, admin credential material, database credentials.

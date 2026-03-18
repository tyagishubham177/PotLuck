# Versioning Policy

## Contract Strategy
- Use additive versioning by default.
- Breaking wire changes require a new versioned endpoint or event namespace.
- All event payloads include `schemaVersion`.
- `schemaVersion` is an integer starting at `1`.
- Clients must tolerate unknown fields.

## REST Rules
- Backward-compatible changes may add optional fields.
- Required field removals or semantic changes require `/v2/...` endpoints.
- Error code strings are stable API surface.

## Realtime Rules
- Event names remain stable once released.
- If payload meaning changes incompatibly, emit a new event name rather than overloading the old one.
- During migrations, server may emit both old and new event shapes to staged clients only.

## Data Migration Rules
- Durable schema migrations must be forward-safe and rollback-aware.
- New database columns should be nullable or have safe defaults until all writers are upgraded.
- Replay logic in `packages/game-engine` must remain deterministic across persisted hand versions.

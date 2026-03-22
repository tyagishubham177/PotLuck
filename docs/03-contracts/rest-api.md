# REST API Contract

## Health Endpoint
| Endpoint | Method | Request | Response |
| --- | --- | --- | --- |
| `/api/health` | GET | none | status, version, timestamp |

## Auth Endpoints
| Endpoint | Method | Request | Response |
| --- | --- | --- | --- |
| `/api/auth/session` | GET | cookie-backed session | authenticated flag, session envelope, actor |
| `/api/auth/admin/login` | POST | password | admin session, user profile |
| `/api/auth/logout` | POST | access or refresh cookie/token | success |
| `/api/auth/refresh` | POST | refresh cookie/token | rotated session |

## Room Endpoints
| Endpoint | Method | Request | Response |
| --- | --- | --- | --- |
| `/api/rooms` | POST | room config | room id, code, config snapshot |
| `/api/rooms/{code}` | GET | room code | public room summary |
| `/api/rooms/{code}/join` | POST | nickname | guest session, lobby snapshot |
| `/api/rooms/{roomId}/leave` | POST | session | success |
| `/api/rooms/{roomId}/seats/{seatIndex}` | POST | buy-in intent or reserve | seat reservation or seated snapshot |
| `/api/rooms/{roomId}/config` | PATCH | partial config | updated room config |
| `/api/rooms/{roomId}/close` | POST | admin session | room archived |

## Buy-In Endpoints
| Endpoint | Method | Request | Response |
| --- | --- | --- | --- |
| `/api/rooms/{roomId}/buyin/quote` | GET | session | min, max, rules summary |
| `/api/rooms/{roomId}/buyin` | POST | amount, seat index | ledger result, updated stack |
| `/api/rooms/{roomId}/rebuy` | POST | amount | ledger result, updated stack |
| `/api/rooms/{roomId}/topup` | POST | amount | ledger result, next-hand stack |

## Admin Endpoints
| Endpoint | Method | Request | Response |
| --- | --- | --- | --- |
| `/api/rooms/{roomId}/pause` | POST | admin session | paused room snapshot |
| `/api/rooms/{roomId}/resume` | POST | admin session | resumed room snapshot |
| `/api/rooms/{roomId}/kick` | POST | player id, reason | moderation record |
| `/api/rooms/{roomId}/lock` | POST | lock state | updated room permissions |

## History Endpoints
| Endpoint | Method | Request | Response |
| --- | --- | --- | --- |
| `/api/rooms/{roomId}/hands` | GET | `cursor`, `limit` | `items[]`, `nextCursor` |
| `/api/rooms/{roomId}/session-summary` | GET | admin session | player totals, final stacks, net chip results |
| `/api/rooms/{roomId}/settle-up` | GET | admin session | settle-up view derived from chip-to-dollar ratio |
| `/api/hands/{handId}` | GET | session | full transcript |
| `/api/hands/{handId}/export.json` | GET | session | JSON file |
| `/api/hands/{handId}/export.txt` | GET | session | human-readable transcript |

## Contract Rules
- `room code` is for discovery and unauthenticated room entry; `roomId` is for authenticated room-scoped operations after the room is known.
- Session endpoints may rely on signed httpOnly cookies in the browser flow, but must also validate explicit bearer tokens when present.
- All write endpoints require authenticated admin or room-scoped guest session tokens as appropriate.
- All mutating requests accept an idempotency key header.
- Validation failures return typed errors, never generic `400` text.
- Config edits touching gameplay rules are rejected during active hands.
- Cursor pagination is the default for list endpoints; offset pagination is out of scope for v1.

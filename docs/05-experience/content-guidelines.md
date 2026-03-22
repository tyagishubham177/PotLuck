# Content Guidelines

## Tone
- Concise, technical, and unambiguous.
- Friendly enough for casual play, but never jokey in rules, settlements, or errors.
- Chips language only; avoid currency-like labels in v1.
- Never use the `$` symbol in the UI; use `chips` or `CR` for product-facing values.

## Navigation Consistency
- The top bar must always read: `PotLuck | Lobby · Tables · History | icons`.
- Context such as `Admin Console` or `Table 2` belongs in a breadcrumb or subheader below the main nav.
- Do not swap core navigation labels for tournaments, cashier, vault, or room-specific marketing names.

## Number Display Contract
- All chip amounts use `Space Grotesk`.
- Values at or above `1,000` use comma grouping.
- Values at or above `1M` may use compact notation such as `1.2M`.
- Always suffix with `chips` or `CR` depending on context.
- Do not mix `chips`, `CR`, and bare numbers in the same surface without a label.

## Terminology
| Use | Avoid |
| --- | --- |
| chips | dollars, money |
| CR | currency symbols |
| room | lobby if ambiguous |
| session | game when duration summary is intended |
| host | admin in player-facing copy |
| hand history | replay unless actual replay exists |
| odd chip | leftover chip |
| sit out next hand | pause seat |
| settle-up | cash out, payout |
| session summary | final bill |

## Formatting Rules
- Use comma-separated numbers for standard values, for example `1,000` and `25,000`.
- Use short-form compact numbers for large secondary surfaces only when precision is not required.
- Use relative time for timestamps newer than `24` hours.
- Use local date and time formatting for older timestamps and exports.

## UI Copy Rules
- Action buttons must use standard poker verbs.
- Admin warnings must explain timing restrictions: `Applies after current hand`.
- Error copy must pair human language with stable error codes in support surfaces.
- Export screens must show what is included: actions, board, pots, settlements, and audit metadata.
- Session summary copy should clearly distinguish chip results from settle-up equivalents.
- Settle-up copy should state that PotLuck calculates suggested amounts but does not move money.

## Empty State Copy Templates
| Context | Copy |
| --- | --- |
| No rooms joined | `No room selected yet. Join with a code to enter a private table.` |
| Waiting for players | `Waiting for players. Two ready seats starts the next hand.` |
| No hands yet | `No hands yet. Played hands will appear here once the room starts.` |
| Full room | `This room is full right now. Try again later or ask the host when a seat opens.` |
| No recent room | `No saved room yet. Join with a code or host a fresh table.` |
| Empty session summary | `Preparing session summary...` |
| No settle-up needed | `No settle-up needed. Everyone finished even.` |
| Empty admin issues | `No live issues. Room controls are ready.` |

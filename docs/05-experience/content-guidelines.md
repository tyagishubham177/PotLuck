# Content Guidelines

## Tone
- Concise, technical, and unambiguous.
- Friendly enough for casual play, but never jokey in rules, settlements, or errors.
- Chips language only; avoid currency-like labels in v1.
- Never use the `$` symbol in the UI; use `chips` for gameplay surfaces.

## Terminology
| Use | Avoid |
| --- | --- |
| chips | dollars, money |
| room | lobby if ambiguous |
| hand history | replay unless actual replay exists |
| odd chip | leftover chip |
| sit out next hand | pause seat |
| settle-up | cash out, payout |
| session summary | final bill |

## Formatting Rules
- Use comma-separated numbers for standard values, for example `1,000` and `25,000`.
- Use short-form compact numbers for large secondary surfaces, for example `10K+`, only when precision is not required.
- Use relative time for timestamps newer than `24` hours, for example `5m ago`.
- Use local date and time formatting for older timestamps and exports.

## UI Copy Rules
- Action buttons must use standard poker verbs.
- Admin warnings must explain timing restrictions: `Applies after current hand`.
- Error copy must pair human language with stable error codes in support surfaces.
- Export screens must show what is included: actions, board, pots, settlements, and audit metadata.
- Session summary copy should clearly distinguish chip results from settle-up equivalents.
- Settle-up copy should state that PotLuck calculates the suggested amounts but does not move money.

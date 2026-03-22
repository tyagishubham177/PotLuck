# Settlement Spec

## Inputs Required Per Hand
- `contributionTotal[playerId]`: chips committed across the entire hand.
- `contributionByStreet[playerId][street]`: per-street chip commitments for audit display.
- `playerState[playerId]`: active, folded, or all-in at betting close.
- `handRank[playerId]`: evaluated showdown rank for eligible non-folded players.
- `oddChipRule`: room-level odd-chip rule.

## Deterministic Side-Pot Algorithm
1. Gather all players with `contributionTotal > 0`.
2. Build sorted distinct contribution levels in ascending order.
3. For each adjacent level segment:
   - `segmentStart = prior level or 0`
   - `segmentEnd = current level`
   - `contributors = players where contributionTotal >= segmentEnd`
   - `segmentAmount = (segmentEnd - segmentStart) * contributors.count`
4. Create pots in ascending segment order:
   - first segment becomes the main pot
   - later segments become side pots with incrementing pot indexes
5. Pot eligibility:
   - eligible winners are contributors for that segment who have not folded
   - folded players still count toward contributed amount but cannot win
6. Evaluate each pot independently using the best showdown rank among eligible players.
7. Split each pot evenly among winners.
8. If the split leaves remainder chips, distribute odd chips according to `LEFT_OF_BUTTON`.
9. Write settlement records and matching ledger entries transactionally.

## Payout Order
- Build pots from smallest cap to largest cap.
- Resolve winners in ascending pot order for readability and deterministic audit output.
- A player may win multiple pots.
- Display side-pot badges in the same ascending order used for settlement.

## Odd Chip Rule
- v1 uses `LEFT_OF_BUTTON` only.
- When a pot split produces remainder chips, distribute one chip at a time to winners starting from the first winning occupied seat left of the button and moving clockwise across the winning set.

## Worked Example 1: Four-Way All-In
| Player | Contribution | Status | Showdown Result |
| --- | --- | --- | --- |
| Ava | 50 | All-in | Pair of Aces |
| Ben | 120 | All-in | Straight |
| Cy | 200 | Active to showdown | Straight |
| Dia | 200 | Active to showdown | Two Pair |

### Pot Construction
- Main pot: `50 * 4 = 200`, eligible winners: Ava, Ben, Cy, Dia
- Side pot 1: `(120 - 50) * 3 = 210`, eligible winners: Ben, Cy, Dia
- Side pot 2: `(200 - 120) * 2 = 160`, eligible winners: Cy, Dia

### Awards
- Main pot: Ben and Cy tie with a straight -> `100` each
- Side pot 1: Ben and Cy tie with a straight -> `105` each
- Side pot 2: Cy beats Dia -> `160` to Cy

### Final Net
| Player | Winnings | Net Result |
| --- | --- | --- |
| Ava | 0 | -50 |
| Ben | 205 | +85 |
| Cy | 365 | +165 |
| Dia | 0 | -200 |

## Worked Example 2: Folded Contributor And Odd Chip
Button is seat 1. Winning seats are 3 and 5. Odd-chip rule is `LEFT_OF_BUTTON`.

| Player | Seat | Contribution | Status | Showdown Result |
| --- | --- | --- | --- | --- |
| Nia | 2 | 25 | All-in | Pair of Queens |
| Omar | 3 | 80 | All-in | Flush |
| Pia | 5 | 80 | All-in | Flush |
| Quin | 6 | 200 | Active to showdown | Two Pair |
| Rui | 8 | 200 | Folded on turn | Folded |

### Pot Construction
- Main pot: `25 * 5 = 125`, eligible winners: Nia, Omar, Pia, Quin
- Side pot 1: `(80 - 25) * 4 = 220`, eligible winners: Omar, Pia, Quin
- Side pot 2: `(200 - 80) * 2 = 240`, eligible winners: Quin only because Rui folded

### Awards
- Main pot: Omar and Pia tie with a flush -> `62` each, `1` odd chip remains
- Odd chip goes to Omar because seat 3 is the first winning seat left of button seat 1
- Side pot 1: Omar and Pia tie -> `110` each
- Side pot 2: Quin wins uncontested -> `240`

### Final Net
| Player | Winnings | Net Result |
| --- | --- | --- |
| Nia | 0 | -25 |
| Omar | 173 | +93 |
| Pia | 172 | +92 |
| Quin | 240 | +40 |
| Rui | 0 | -200 |

## Edge Cases
- One player all-in for less than the minimum raise: does not reopen betting unless it forms a full raise.
- No-action streets: contributions for that street remain zero, but hand progression still records a street transition.
- Everyone folds to a bet: no showdown, award directly, still create audit and ledger records.
- Disconnect on turn: timer expiry applies `CHECK` if legal, otherwise `FOLD`.
- Settlement failure after pot computation but before commit: hand remains paused and unfinalized; no partial payouts are visible.

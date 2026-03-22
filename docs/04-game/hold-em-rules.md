# Hold'em Rules

## Table Variant
- Texas Hold'em, no-limit, 52-card deck.
- Seat count: 2 to 9.
- Optional ante.
- Optional UTG straddle only in v1.
- Betting is uncapped beyond table stakes because the game is no-limit.

## Hand Lifecycle
1. Determine eligible players for the next hand.
2. Advance button clockwise with dead-button handling if seats are empty.
3. Post ante if enabled.
4. Post blinds.
5. Offer UTG straddle if room allows and seat is occupied.
6. Shuffle and deal two private cards to each participating player.
7. Run betting rounds: preflop, flop, turn, river.
8. If one player remains, award immediately.
9. Otherwise evaluate showdown and settle all pots.
10. Enter between-hands state for top-ups, config edits, and readying.

## Betting Semantics
- Legal actions: `FOLD`, `CHECK`, `CALL`, `BET`, `RAISE`, `ALL_IN`.
- Minimum opening bet on postflop streets is the big blind unless a different forced amount already applies.
- Minimum raise is based on the size of the previous full bet or raise.
- A short all-in that does not constitute a full raise does not reopen action for players who have already acted.
- If a player cannot fully call, the action becomes an all-in call for the remaining stack.

## Straddle Rules
- v1 supports UTG straddle only.
- The straddle amount is exactly `2x` the big blind.
- When posted, the straddler acts last in the preflop betting round unless action is otherwise closed by all-in behavior.
- Postflop order remains unchanged.

## Showdown Rules
- If betting closes with more than one eligible player, showdown is required.
- The last aggressor on the final betting street shows first.
- If there was no final-street aggressor, the first live seat left of the button shows first.
- Remaining eligible players may show or muck in clockwise order after that.
- Losing players may muck their cards instead of exposing them once a better hand has been shown and all pots they could win are lost.

## All-In Handling
- Contributions are tracked both as total hand commitment and by street.
- Once all remaining eligible players are all-in and no further betting is possible, the server auto-deals the remaining board with appropriate pacing and then proceeds to showdown.
- No additional chip movement occurs after betting is locked except settlement.

## Dead Button Handling
- Heads-up: button posts small blind and acts first preflop, last postflop.
- Three or more players: button, small blind, and big blind advance clockwise to the next occupied eligible seats.
- If an empty seat would otherwise receive the button, the button is dead for that hand but blind obligations still move to the next occupied seats according to live-game rules.

## End Conditions
- Everyone folds except one player: award all current pots immediately, skip further dealing.
- Betting ends with multiple players live: showdown required.
- Room pause during active hand: freeze timers, preserve state, and resume only from persisted hand state.

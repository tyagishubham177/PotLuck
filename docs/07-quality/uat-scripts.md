# UAT Scripts

## UAT-01 Create And Share Room
- Admin signs in with password or PIN, creates room, copies room code, reopens room summary.
- Pass if config persists and code works for a fresh guest join.

## UAT-02 Join Seat Buy-In
- Guest joins by code, chooses seat, buys in within bounds.
- Pass if seat locks correctly and stack matches ledger.

## UAT-03 Side Pot Resolution
- Reproduce a scripted multi-way all-in with at least one folded contributor.
- Pass if pot amounts, winners, odd chip, and final stacks match expected transcript.

## UAT-04 Timeout And Reconnect
- Disconnect acting player, wait for timeout, reconnect.
- Pass if auto-action occurs correctly and room state remains coherent.

## UAT-05 Admin Between-Hands Edit
- Change blinds and chip-to-dollar ratio between hands.
- Pass if current hand is unaffected and next hand uses updated rules.

## UAT-06 Session Summary And Settle-Up
- Close a room after multiple buy-ins, rebuys, and top-ups.
- Pass if the session summary shows final stacks and net chips correctly, and the settle-up view reflects the configured ratio.

## UAT-07 Session Isolation And Stale-State Cleanup
- Join a room in one tab as a player, then join the same room from another tab or browser context as a different guest and also try an invalid room lookup afterwards.
- Pass if each tab shows the correct hero identity, stale room data is cleared after failed lookup or join, and no tab retains the previous player's seat, stack, or action controls once the auth session changes.

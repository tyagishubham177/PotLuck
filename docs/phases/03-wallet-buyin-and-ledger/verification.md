# Phase 03: Wallet, Buy-In, and Ledger Verification

## Run Commands
- pnpm test
- pnpm --filter @potluck/server test
- pnpm typecheck
- pnpm dev

## Manual Test Checklist

## Setup
- Check out the branch for this phase: `git checkout codex/phase3-wallet-buyin-ledger`
- Install dependencies if needed: `pnpm install`
- Start the workspace: `pnpm dev`
- Keep the server test command handy for comparison: `pnpm --filter @potluck/server test`

## UAT-03-01 Admin Creates A Wallet-Enabled Room
- Request an admin OTP and sign in.
- Create a room with the default Phase 03 room settings.
- Confirm the lobby opens and the room summary still shows the expected buy-in range.
- Pass if the room is created successfully and the room config keeps both rebuy and top-up enabled.

## UAT-03-02 Guest Reserves A Seat And Commits A Valid Buy-In
- Join the room as a guest player.
- Reserve any open seat.
- Submit a buy-in within the displayed min/max range.
- Refresh the lobby snapshot.
- Pass if the seat changes from `RESERVED` to `OCCUPIED` and the visible stack equals the committed amount.

## UAT-03-03 Buy-In Minimum Is Enforced
- Join as a fresh guest player and reserve a different open seat.
- Attempt a buy-in below the room minimum.
- Pass if the request is rejected with `ERR_MIN_BUYIN` and the seat remains reserved with no stack applied.

## UAT-03-04 Buy-In Maximum Is Enforced
- Use a reserved seat that has not bought in yet.
- Attempt a buy-in above the room maximum.
- Pass if the request is rejected with `ERR_MAX_BUYIN` and the seat stays reserved.

## UAT-03-05 Idempotent Buy-In Does Not Double Credit Chips
- Submit the same buy-in request twice with the same `Idempotency-Key`.
- Pass if both responses succeed, both responses return the same ledger entry id, and the player's stack increases only once.

## UAT-03-06 Top-Up Works Between Hands
- Use a player who already has an occupied seat and a non-zero stack.
- Submit a top-up that keeps the final stack at or below the configured maximum.
- Refresh the lobby.
- Pass if the request succeeds and the stack increases by exactly the top-up amount.

## UAT-03-07 Top-Up Rejects Over-Max Requests
- Use a seated player who already has chips.
- Attempt a top-up that would push the stack above the room maximum.
- Pass if the request is rejected with `ERR_MAX_BUYIN` and the stack does not change.

## UAT-03-08 Top-Up During Active Hand Is Rejected
- Put the room into an active-hand test state using the Phase 03 server test seam or equivalent debug hook.
- Attempt a top-up during that active-hand state.
- Pass if the request is rejected with `ERR_TOPUP_DURING_HAND` and the stack remains unchanged.

## UAT-03-09 Rebuy Works Only When Allowed
- Create or use a room with `rebuyEnabled=false`.
- Use a seated player whose stack has already been reduced to zero through the test seam or scripted setup.
- Attempt a rebuy.
- Pass if the request is rejected with `ERR_REBUY_DISABLED`.

## UAT-03-10 Rebuy After Bust Restores The Seat Stack
- Use a room with `rebuyEnabled=true`.
- Reduce a seated player's stack to zero through the Phase 03 test seam or scripted setup.
- Submit a valid rebuy within the room min/max range.
- Refresh the lobby.
- Pass if the request succeeds and the occupied seat stack equals the rebuy amount.

## UAT-03-11 Ledger Failure Does Not Mutate Seat State
- Run the server with the failing-ledger test seam or reproduce the failure path in a controlled dev build.
- Reserve a seat and attempt a buy-in while the ledger commit path is forced to fail.
- Pass if the request returns `ERR_LEDGER_COMMIT_FAILED`, the seat remains `RESERVED`, and no stack is shown for that seat.

## UAT-03-12 Compensating Adjustment Reconciles Balance
- Use the compensating-adjustment test seam for a player who already has committed chips.
- Apply the compensating adjustment.
- Inspect the resulting room balance summary or automated test output.
- Pass if the net balance is reduced by the adjustment amount and later wallet actions continue from the corrected balance.

## Failure Cases
- Ledger commit failure leaves seat stack unchanged.
- Compensating entry flow is documented and testable.

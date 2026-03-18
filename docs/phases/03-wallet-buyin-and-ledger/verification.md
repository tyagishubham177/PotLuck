# Phase 03: Wallet, Buy-In, and Ledger Verification

## Run Commands
- pnpm test
- pnpm --filter server test

## Manual Checks
- Player can buy in within bounds.
- Top-up during active hand is rejected.
- Rebuy path works only when allowed by room rules.

## Failure Cases
- Ledger commit failure leaves seat stack unchanged.
- Compensating entry flow is documented and testable.

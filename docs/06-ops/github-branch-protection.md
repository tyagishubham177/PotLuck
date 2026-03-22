# GitHub Branch Protection Baseline

## Why This Exists
- GitHub Actions can validate a pull request, but they cannot reliably block force-pushes or direct pushes to `master` by themselves.
- The repo therefore needs both:
  - repo-side automation in `.github/workflows/`
  - GitHub branch protection or rulesets applied in repository settings

## Repo-Enforced Automation
- `PR Safety` runs on every pull request into `master`.
- The workflow blocks pull requests when:
  - the source branch is `master` or `main`
  - the source branch does not use an approved prefix such as `codex/`, `feature/`, `fix/`, `docs/`, or `release/`
  - required docs-first repo paths are missing
- The workflow is also future-safe:
  - once `package.json` exists, pull requests must define and pass `lint`, `typecheck`, `test`, and `build` scripts before merge
- `Rollback Tags` creates one daily annotated `rollback-YYYY-MM-DD` tag on `master`.
- Rollback tag pruning rules:
  - keep the newest 5 rollback tags no matter how old they are
  - after that, delete rollback tags older than 7 days

## GitHub Settings To Apply
Apply these rules to `master` in GitHub repository settings.

1. Require a pull request before merging.
2. Do not require approving reviews for merge if you are the only active developer.
3. Require conversation resolution before merging.
4. Require status checks to pass before merging.
5. Mark `PR Safety` and `verify` as required status checks.
6. Leave admin enforcement off so you can bypass protection when a non-critical issue should not block you.
7. Disable force pushes.
8. Disable branch deletion.
9. Prefer linear history if you want a cleaner rollback trail.

## Recommended Ruleset Name
- `Protect master`

## Verification Steps
1. Open GitHub repository settings.
2. Configure a branch protection rule or ruleset for `master`.
3. Confirm `PR Safety` appears in the required checks list after the first workflow run.
4. Confirm approvals are not required and that admins can still merge when an optional issue should be bypassed.
5. Attempt a test pull request from a badly named branch and confirm it fails.
6. Confirm `Rollback Tags` can be run manually from the Actions tab.


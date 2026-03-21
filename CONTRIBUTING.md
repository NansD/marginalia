# Contributing to Marginalia

Thanks for contributing. This repository is in the early foundation phase, so small, well-scoped pull requests are preferred.

## Workflow

1. Start from the latest `main`.
2. Create a descriptive branch, for example `docs/update-readme` or `feat/popup-scaffold`.
3. Keep each pull request focused on one change set.
4. Update docs and tests when behavior, commands, or developer workflow changes.
5. Open a pull request back to `main`.

## Pull Request Expectations

Every pull request should include:

- a short summary of what changed
- why the change is needed
- testing notes listing the commands you ran locally
- screenshots when UI surfaces changed
- links to the relevant planning item when useful, such as [`plans/plan-marginalia.md`](plans/plan-marginalia.md)

## Required Local Checks

Run the same checks used by CI before requesting review:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

## Required GitHub Checks

Configure branch protection for `main` to require these checks:

- `pr-checks / lint`
- `pr-checks / typecheck`
- `pr-checks / test`
- `ci / verify`
- `ci / build`

## CI Workflows

- `.github/workflows/pr-checks.yml` provides fast pull-request feedback.
- `.github/workflows/ci.yml` runs the full verification flow on pull requests and pushes to `main`, then uploads the built extension output from `dist/`.

## Review and Merge Guidance

- Prefer squash merges unless project conventions change later.
- Do not merge while required checks are failing.
- If a PR changes developer workflow, update `README.md` and this guide in the same branch.

# Phase 8M — Staging Deployment Report

Status: BLOCKED — BUILD FAILED, REPAIR IN PROGRESS

The first staging deployment was intentionally limited to the isolated staging
resource. Coolify queued deployment `pqb78qie6atmxvsk2mke8jp3` for commit
`3790087` and marked it failed. Docker daemon evidence identifies the first
failed step as the Nixpacks install phase:

`pnpm install --frozen-lockfile` exited with code 1.

Coolify did not return deployment logs because the API token lacks sensitive-log
permission; no error text is invented here. A repository-level `nixpacks.toml`
was added to activate pnpm 12.18.0 through Corepack before the frozen install.
The deployment will be retried after this repair is pushed and its result will
be recorded here.

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
The first Dockerfile retry built successfully but the runtime container exited
with code 1 and entered a restart loop. The local image reproduced the cause:
the separate `node:24-bookworm-slim` runtime stage had no usable `pnpm` command
for the non-root runtime user. The runtime command is now the equivalent direct
Next.js invocation, avoiding package-manager download and lockfile writes in the
running container. The next deployment reached a working application endpoint
(`GET /api/health` returned 200 with database and storage `ok`), but the Docker
health probe itself failed because the slim runtime lacked both `curl` and
`wget`. The runtime image now includes `curl` for Coolify's probe. The
deployment will be retried after this repair is pushed.

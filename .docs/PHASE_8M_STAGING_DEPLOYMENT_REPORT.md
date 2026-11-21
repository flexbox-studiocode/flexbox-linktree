# Phase 8M — Staging Deployment Report

Status: PASS — STAGING DEPLOYED AND HEALTHY

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
`wget`. The runtime image now includes `curl` for Coolify's probe. Deployment
`jzutavljasxm0wb2ae69rtfu` for commit `8edad45` finished successfully.

Evidence from the running Coolify-managed container:

- Container status: `running (healthy)`.
- Runtime user: `node` (UID/GID 1000:1000 in the image).
- Internal `GET /api/health`: HTTP 200; database and storage checks are `ok`.
- Internal `/`, `/robots.txt`, `/sitemap.xml`, and `/admin/login`: HTTP 200.
- Media bind mount: `/data/flexbox/staging/media` to
  `/data/flexbox/media`, read-write, on the `coolify` network.
- Runtime write/read/delete test on the mounted media path: PASS.

The generated `sslip.io` preview hostname is not an external acceptance URL
in this provider setup: public HTTP is intercepted by the provider's
"Domain belum terhubung" page and public HTTPS has no usable certificate.
Local Traefik host routing for the same hostname returns HTTP 200. No
production domain, DNS, NAT, or HTTPS configuration was changed.

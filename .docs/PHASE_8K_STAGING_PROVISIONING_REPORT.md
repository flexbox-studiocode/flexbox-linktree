# Phase 8K — Staging Provisioning Report

Tanggal: 2026-11-21 (UTC)

## Status

- PASS — Environment Coolify `staging` dibuat.
- PASS — Database dan role staging terpisah dibuat.
- PASS — Persistent media directory dan Coolify file mount dibuat.
- PASS — Aplikasi staging dibuat tanpa `instant_deploy`.
- PASS — Environment variables staging disimpan melalui API; secret values tidak dicatat.
- NOT RUN — Staging deployment.

## Resource IDs

| Resource | Identifier |
|---|---|
| Project FlexBox | `32enjjomebsxd77x9llygw9v` |
| Staging environment | `nh2dykdfnvvobytn15ivpwij` |
| Server | `cfyjnljbrw3hl0by9ceno9xm` |
| Docker destination | `eyprbhydx9amjlyl6igmlz5z` |
| Existing PostgreSQL 17 resource | `aswul0ozryb1hxawjfzjsnwj` |
| Staging application | `rnd8cgyvl2p9jpqazcljwolo` |
| Staging storage record | `gbp0kfm7rmna6grq8wh3gaot` |

## Database

- Database: `flexbox_linktree_staging`.
- Role: `flexbox_staging_app`.
- Role is login-enabled and not a superuser.
- Connection was verified over the private `coolify` Docker network.
- No host port 5432 was published.
- Production database and production role were not modified.

## Storage

- Host path: `/data/flexbox/staging/media`.
- Container path: `/data/flexbox/media`.
- Directory mode: 0750, root:root pending runtime UID/GID verification.
- Production media path was not changed.
- Baseline staging database backup was created with custom format and SHA-256 sidecar.

## Application

- Repository: `flexbox-studiocode/flexbox-linktree`, branch `main`.
- Build pack: Nixpacks.
- Internal port: 3000.
- Health check: GET `/api/health` on port 3000.
- Generated Coolify preview hostname exists, but production domains were not assigned.
- Auto deploy and preview deployments are disabled.
- No application container or deployment was started in this provisioning step.

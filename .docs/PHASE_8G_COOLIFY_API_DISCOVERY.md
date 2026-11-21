# Phase 8G Coolify API Discovery

Status: **PASS — discovery authenticated; provisioning completed in Phase 8H**

Audit date: 2026-11-21

## Installation and API

- Coolify: `4.7.6`, healthy (`coollabsio/coolify:4.7.6`).
- Traefik: `3.7.19`, healthy.
- Docker Engine: `29.10.0`.
- Local API health: `/api/health` and `/api/v1/health` returned HTTP 200.
- Bearer-authenticated API requests returned HTTP 200 using the owner-provided
  token loaded from the designated root-only secret store. The token value was
  never printed or committed.
- Official API endpoints were used for projects, environments, servers,
  destinations, databases, applications, resources, storages, environments,
  and deployment history.

## Verified resource identifiers

| Resource | Verified value |
|---|---|
| Project | `FlexBox` / `32enjjomebsxd77x9llygw9v` |
| Environment | `production` / `ksfwczgsk046yv7ownwpptgq` |
| Server | `localhost` / `cfyjnljbrw3hl0by9ceno9xm` |
| Destination | `coolify` / `eyprbhydx9amjlyl6igmlz5z` |
| Docker network | `coolify` |
| Existing database | `aswul0ozryb1hxawjfzjsnwj` |
| New application | `flexbox-linktree` / `4fndzksd1vmizwovi2bmvwmf` |

The project has one `production` environment. The server has one matching
`coolify` Docker destination. No pre-existing FlexBox application or service
was found, so no duplicate application was created.

## Existing PostgreSQL resource

- Image: `postgres:17-alpine`.
- Status: `running:healthy`.
- Public flag: `false`.
- Host port 5432: not published; no host listener exists.
- Docker network: `coolify`.
- Persistent volume: `postgres-data-aswul0ozryb1hxawjfzjsnwj`.
- Existing default database/role were preserved.

## Safety result

Discovery and resource relationships are now verified. No Coolify internal
database or undocumented table was accessed. The API token remains in the
designated root-only secret store and is not part of the repository or reports.

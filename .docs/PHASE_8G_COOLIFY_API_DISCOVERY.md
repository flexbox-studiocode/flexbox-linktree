# Phase 8G Coolify API Discovery

Status: **BLOCKED — authentication required before provisioning**

Audit date: 2026-11-21

## Installation

- Coolify container image: `coollabsio/coolify:4.7.6`
- Runtime metadata version: `4.7.6`
- Traefik: `3.7.19`
- Docker Engine: `29.10.0`
- Coolify health: healthy
- A Coolify-managed PostgreSQL 17 resource is now present; no FlexBox
  application resource is present.

The original Phase 8 baseline named Coolify 4.7.5. The running installation is
now 4.7.6; no upgrade or downgrade was performed by this audit.

## API availability

The local Coolify service was checked on `http://127.0.0.1:8000`:

| Endpoint | Result |
|---|---|
| `/api/health` | HTTP 200 |
| `/api/v1/health` | HTTP 200 |
| `/api/v1/version` | HTTP 401 |
| `/api/v1/projects` | HTTP 401 |
| `/api/v1/applications` | HTTP 401 |
| `/api/v1/databases` | HTTP 401 |
| `/api/v1/servers` | HTTP 401 |
| `/api/v1/resources` | HTTP 401 |

This proves the API is reachable and protected. During the current Phase 8H
execution, `COOLIFY_API_TOKEN` was not present in the automation process
environment. The token was not requested in chat, searched for in shell
history, or printed. The discovery request therefore could not safely be
authenticated from this execution session.
No internal Coolify database or tables were inspected or modified.

## Official API capabilities confirmed

The official Coolify API documentation provides:

- `GET /api/v1/projects`
- `GET /api/v1/servers`
- `GET /api/v1/resources`
- `GET /api/v1/databases`
- `POST /api/v1/databases/postgresql`
- `POST /api/v1/applications/public`
- `POST /api/v1/applications/{uuid}/storages`
- Environment variable and resource status endpoints

Provisioning requires a Bearer API token and verified project, environment,
server, and destination UUIDs. The application and database create requests
also support explicit `instant_deploy=false`, private database settings, health
checks, domains, ports, and storage configuration.

## Required owner action

Make the already-created Coolify API token available to the automation through
the VPS secret store or the active execution environment. Do not paste the
token into chat, Git, or a command that will be retained in shell history.
The next execution must confirm only that the variable is present; its value
must never be printed.

Recommended staged permissions:

1. Discovery token: `read`, scoped to the required team/resources.
2. Provisioning token: `read` + `write`, with `deploy` added only when an
   explicitly approved deployment operation is ready.

The token must be created for the team that owns the FlexBox resources. On
self-hosted Coolify, API access must also be enabled in the official settings;
IP allowlisting should be restricted to the VPS/operator source as appropriate.

## Resource observed after discovery

- Database resource UUID/container: `aswul0ozryb1hxawjfzjsnwj`.
- Project: `flexbox`.
- Environment: `production`.
- Image: `postgres:17-alpine`.
- Status/health: running/healthy.
- Network: external Docker network `coolify` with private container address.
- Host port 5432: not published and no host listener found.
- Persistent volume: `postgres-data-aswul0ozryb1hxawjfzjsnwj` mounted at
  `/var/lib/postgresql/data`.
- Initialized database/role: only default `postgres` database and superuser
  role were found; `flexbox_linktree` and `flexbox_app` do not exist.

The resource is healthy but not yet application-ready. Changing only
`POSTGRES_DB` or `POSTGRES_USER` in the generated Compose file would not create
objects in an already initialized PostgreSQL volume. The target database/user
must be created through an approved Coolify/ PostgreSQL administration flow,
with the generated password then stored in Coolify secret management.

## Safety result

No resource was created, no deployment was triggered, no secret was printed,
and no Coolify internal data was changed. Continuing without a valid token
would require guessing resource IDs or manipulating internal database state,
which is prohibited.

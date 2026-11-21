# Phase 8G Coolify API Discovery

Status: **BLOCKED — authentication required before provisioning**

Audit date: 2026-11-21

## Installation

- Coolify container image: `coollabsio/coolify:4.7.6`
- Runtime metadata version: `4.7.6`
- Traefik: `3.7.19`
- Docker Engine: `29.10.0`
- Coolify health: healthy
- No FlexBox application or PostgreSQL 17 resource is present.

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

This proves the API is reachable and protected. No token was present in the
VPS process environment, Coolify container environment, or available CLI tools.
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

Create a short-lived Coolify API token through the official dashboard
(`Keys & Tokens` → `API Tokens`) and make it available to the automation through
the VPS secret store or an interactive environment variable. Do not paste the
token into chat, Git, or a command that will be retained in shell history.

Recommended staged permissions:

1. Discovery token: `read`, scoped to the required team/resources.
2. Provisioning token: `read` + `write`, with `deploy` added only when an
   explicitly approved deployment operation is ready.

The token must be created for the team that owns the FlexBox resources. On
self-hosted Coolify, API access must also be enabled in the official settings;
IP allowlisting should be restricted to the VPS/operator source as appropriate.

## Safety result

No resource was created, no deployment was triggered, no secret was printed,
and no Coolify internal data was changed. Continuing without a valid token
would require guessing resource IDs or manipulating internal database state,
which is prohibited.

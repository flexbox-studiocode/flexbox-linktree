# Phase 8G Coolify Deployment Report

Status: **BLOCKED — NOT YET DEPLOYED**

## Target configuration

- Repository: `https://github.com/flexbox-studiocode/flexbox-linktree`
- Branch: `main`
- Resource name: `flexbox-linktree`
- Runtime: Node.js 24
- Package manager: pnpm 12.18.0
- Internal port: 3000
- Start command: `pnpm start`
- Health check: `GET /api/health`
- Canonical domain: `https://microsite.flexbox.web.id`
- WWW alias: `https://www.microsite.flexbox.web.id`
- Media host/container path: `/data/flexbox/media`

## Current state

- Coolify API health is reachable.
- Protected API is reachable but unauthenticated.
- No project/environment/server/destination UUIDs were obtained.
- No application resource was created.
- No PostgreSQL 17 resource was created.
- No environment variables or secrets were sent to Coolify.
- No deployment was triggered.

## Required provisioning sequence after API authorization

1. List and verify the target team, project, environment, server, and Docker
   destination.
2. Confirm capacity and ensure no duplicate FlexBox resources exist.
3. Create PostgreSQL 17 with `is_public=false`, private networking, persistent
   storage, health checks, database `flexbox_linktree`, and user `flexbox_app`.
4. Verify database status and internal network without exposing credentials.
5. Create the Next.js application from `main` with `instant_deploy=false`.
6. Attach `/data/flexbox/media` using the official application storage endpoint.
7. Add non-secret configuration and Coolify secret variables.
8. Validate the resource definitions before any deployment request.

Production migration, DNS/HTTPS cutover, and email delivery remain separately
gated owner actions.

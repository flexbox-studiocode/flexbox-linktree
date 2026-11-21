# Phase 8AB — Production Deployment Report

Date: 2026-11-21 UTC
Status: **BLOCKED — NOT DEPLOYED**

## Scope

- Existing Coolify application: `4fndzksd1vmizwovi2bmvwmf`
- Release branch: `main`
- Verified source commit: `803497b053633630e4a53081deec69099e2aa9c7`
- Build pack: Dockerfile, `/Dockerfile`
- Internal port: `3000`
- Health path: `/api/health`
- Database: private PostgreSQL resource `aswul0ozryb1hxawjfzjsnwj`
- Media mount: `/data/flexbox/media` → `/data/flexbox/media`

## Attempts

1. `emm0gvghvc5gfhwk7rd0hach` — failed at 10:37:13 UTC.
2. `f1gulmpxlksvahzmdrhrgwev` — failed at 10:40:38 UTC.

Coolify accepted both trigger requests, but both jobs failed within roughly
four seconds. No production container, image, Traefik router, or application
runtime was created. Staging was not modified.

The application configuration was checked between attempts. The canonical and
WWW domains, Dockerfile, port, health path, and media storage remained correct.
The application-level resolver is now `letsencrypt` and force-HTTPS is enabled.

## Diagnostic blocker

The deployment records have no persisted log text. The official application
logs endpoint returns HTTP 403 because the current API token lacks
`read:sensitive`. The Coolify service log only records job start/failure, not
the first failing command. This prevents an evidence-based repair.

## Safety checks

- No migration or seed was rerun.
- No database, volume, media, DNS, NAT, firewall, SSH, or nameserver change was
  made.
- PostgreSQL port 5432 remains private.
- No email was enabled or sent.

## Owner action required

Grant the automation token the minimum `read:sensitive` permission, or inspect
the deployment log in Coolify and provide the first failing stage. Do not send
the token or any secret in chat. After the first failing stage is available,
perform one diagnosed correction and one controlled retry.

Reference: [Coolify application logs API](https://coolify.io/docs/api/endpoints/applications/get-application-logs-by-uuid).

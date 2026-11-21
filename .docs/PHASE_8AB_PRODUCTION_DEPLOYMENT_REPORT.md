# Phase 8AB — Production Deployment Report

Date: 2026-11-21 UTC
Status: **PASS — DEPLOYED; PUBLIC ACCEPTANCE IN PROGRESS**

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
3. `fdgflvggtorjq4pqfuf1gkrj` — finished at 11:10:31 UTC.

The first two jobs failed within roughly four seconds because Coolify generated
the invalid repository target
`https://github.com/https://github.com/flexbox-studiocode/flexbox-linktree`.
The field was corrected to the GitHub source identifier format used by staging.
The third deployment cloned the repository, built the Dockerfile, and created
the healthy production container. Staging was not modified.

The final application configuration is verified with canonical and WWW domains,
Dockerfile `/Dockerfile`, internal port `3000`, health path `/api/health`,
media storage, `letsencrypt` resolver, and force-HTTPS enabled.

## Runtime follow-up

The container is healthy and public health is HTTP 200. Two malformed Next.js
Server Action errors were observed in runtime logs from external requests. They
did not affect homepage, health, or admin-login page delivery, but should be
reviewed before final authenticated acceptance.

## Safety checks

- No migration or seed was rerun.
- No database, volume, media, DNS, NAT, firewall, SSH, or nameserver change was
  made.
- PostgreSQL port 5432 remains private.
- No email was enabled or sent.

## Owner action required

Log in manually at `/admin/login` and perform the approved CMS/media smoke test.
Do not send the administrator password or session data in chat.

Reference: [Coolify application logs API](https://coolify.io/docs/api/endpoints/applications/get-application-logs-by-uuid).

# Phase 8T — Production Deployment Preparation Report

Status: NOT RUN — OWNER APPROVAL REQUIRED

## Prepared deployment plan

- Application UUID: `4fndzksd1vmizwovi2bmvwmf`.
- Release commit: `3c7e236` on `main`.
- Build: repository Dockerfile, Node.js 24, pnpm 12.18.0, direct Next.js
  runtime start, port 3000.
- Health: `GET /api/health` expecting HTTP 200.
- Database: private Coolify PostgreSQL resource
  `aswul0ozryb1hxawjfzjsnwj`, database `flexbox_linktree`.
- Media: `/data/flexbox/media` mounted read-write; runtime UID/GID 1000:1000
  write/read/delete test passed.
- Domains: `microsite.flexbox.web.id` and
  `www.microsite.flexbox.web.id`.
- Email: explicitly disabled; no production email will be sent.
- Backup: fresh verified pre-migration archive exists.

## Gate

Do not trigger Coolify deployment until the owner explicitly approves:

1. production migration after reviewing Phase 8P;
2. first production deployment;
3. domain/HTTPS cutover after provider NAT confirmation.

No production deployment, container, migration, seed, administrator bootstrap,
or public cutover was performed in this phase.

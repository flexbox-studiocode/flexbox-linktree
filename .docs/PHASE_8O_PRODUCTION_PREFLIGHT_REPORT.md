# Phase 8O — Production Final Preflight Report

Status: BLOCKED / OWNER ACTION REQUIRED

Tanggal audit: 2026-11-21 UTC

## Repository and release source

- Branch: `main`.
- Release commit: `3c7e236`.
- Working tree: clean after the documentation commit.
- Source: `flexbox-studiocode/flexbox-linktree`.
- The accepted staging build used the same main branch and Dockerfile now
  selected for the production resource.
- Node.js 24 and pnpm 12.18.0 were validated during the staging build and
  runtime checks.

## Production Coolify resource

- Application UUID: `4fndzksd1vmizwovi2bmvwmf`.
- Repository and branch: correct (`main`).
- Build pack: changed from stale `nixpacks` to `dockerfile` through the
  official Coolify application API; Dockerfile path is `/Dockerfile`.
- Exposed port: `3000`.
- Health check: `GET /api/health`, port `3000`, expected HTTP 200.
- Domains: `https://microsite.flexbox.web.id` and
  `https://www.microsite.flexbox.web.id`.
- Production storage record exists at `/data/flexbox/media`.
- No deployment was triggered by this configuration update.
- No production container exists and production deployment history remains
  empty.

## Environment safety

- Production environment variable names were inspected without reading or
  printing secret values.
- `ADMIN_MAIL_TRANSPORT=disabled` was added explicitly through Coolify's
  protected environment API. Resend was not enabled and no API key was added.
- The actual production secret values cannot be validated until Coolify starts
  a production container; the API intentionally redacts them and no synthetic
  fixture is treated as proof of production validity.
- No production migration, seed, admin bootstrap, email, DNS, NAT, firewall,
  SSH, or SSL operation was performed.

## Result

The application build/runtime configuration is prepared, but production is
blocked by the explicit migration/deployment approval gate and unresolved
provider domain/HTTPS routing. The existing `exited:unhealthy` status is stale
Coolify metadata for a resource with no container; it is not treated as a
successful deployment or a live health result.

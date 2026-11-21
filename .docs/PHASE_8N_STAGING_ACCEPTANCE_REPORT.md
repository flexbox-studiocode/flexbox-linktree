# Phase 8N — Staging Acceptance Report

Status: PASS — INTERNAL STAGING ACCEPTANCE

Staging acceptance evidence:

- Coolify deployment `jzutavljasxm0wb2ae69rtfu` finished successfully.
- Container is `running (healthy)` with the configured Docker health probe.
- `GET /api/health` returned HTTP 200 with `database: ok` and `storage: ok`.
- Staging-only Prisma migrations and seed completed successfully earlier;
  production migration and seed were not run.
- Public page, robots, sitemap, and admin login routes returned HTTP 200 from
  inside the container.
- The `node` runtime user completed a write/read/delete test through the
  persistent staging mount.
- Staging uses its own database, role, media directory, and generated
  preview hostname; it does not use production media or the production
  domain.
- Resource snapshot: approximately 203 MiB container memory, 5.18% of the
  container memory limit.

External preview acceptance is BLOCKED by the provider's separate Domain &
Website layer: the generated `sslip.io` hostname returns a provider
"Domain belum terhubung" page over HTTP, while HTTPS has no usable
certificate. The local Traefik route is valid, so this is not evidence of an
application health failure.

Not run in this phase: administrator bootstrap, production migration, Resend
verification/email, production DNS/NAT/HTTPS cutover, and production deploy.

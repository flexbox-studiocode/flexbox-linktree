# Phase 8G Coolify Deployment Report

Status: **PROVISIONED — NOT DEPLOYED**

## Target configuration

- Repository: `https://github.com/flexbox-studiocode/flexbox-linktree`
- Branch: `main`
- Resource: `flexbox-linktree` (`4fndzksd1vmizwovi2bmvwmf`)
- Build pack: Nixpacks.
- Node target: 24 through `NIXPACKS_NODE_VERSION`.
- Package manager: pnpm 12.18.0 from `packageManager` and frozen lockfile.
- Internal port: 3000.
- Build overrides: `pnpm install --frozen-lockfile`,
  `pnpm db:generate && pnpm build`, and `pnpm start` through official Nixpacks
  environment variables.
- Health check: GET `/api/health` on port 3000.
- Domains configured: `microsite.flexbox.web.id` and
  `www.microsite.flexbox.web.id`.
- WWW behavior: `non-www` redirect target configured.
- Persistent media mount: `/data/flexbox/media` to `/data/flexbox/media`.
- Auto-deploy and forced HTTPS were not enabled for this provisioning stage.

## Provisioning evidence

- Application creation returned HTTP 201 with `instant_deploy=false` in the
  request.
- Storage creation returned HTTP 201.
- Environment variable creation/update returned HTTP 201.
- Application deployment history: count `0`.
- No application container exists in Docker.
- No deployment endpoint was called.

## Intentionally incomplete production configuration

- `ADMIN_MAIL_TRANSPORT` and `RESEND_API_KEY` were not configured because the
  Resend sender domain is not verified.
- `RESEND_SENDER_VERIFIED` remains `false`.
- Production migration, seed, and administrator bootstrap were not run.
- HTTPS certificate issuance and public cutover were not performed.

The API reports the application status as `exited:unhealthy` while no container
or deployment exists. This is not treated as a deployment result; the resource
must be built and deployed only after the remaining preflight and approval gates
are complete.

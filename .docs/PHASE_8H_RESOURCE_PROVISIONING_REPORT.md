# Phase 8H Resource Provisioning Report

Status: **RESOURCE PROVISIONING COMPLETE — APPLICATION NOT YET DEPLOYED**

Audit date: 2026-11-21

## Discovery

Coolify API access was initially blocked because the token was in a separate
SSH shell. The owner designated `/root/.config/flexbox/coolify-api-token` as a
root-only secret store (`root:root`, mode `0600`). Authenticated requests then
returned HTTP 200. The token value was never printed, logged, or committed.

Verified identifiers:

- Project `FlexBox`: `32enjjomebsxd77x9llygw9v`.
- Environment `production`: `ksfwczgsk046yv7ownwpptgq`.
- Server `localhost`: `cfyjnljbrw3hl0by9ceno9xm`.
- Destination `coolify`: `eyprbhydx9amjlyl6igmlz5z`.
- Existing PostgreSQL: `aswul0ozryb1hxawjfzjsnwj`.
- Application: `flexbox-linktree`, `4fndzksd1vmizwovi2bmvwmf`.

## Database result

- Existing PostgreSQL 17 resource and volume were preserved.
- Initial custom-format backup was written outside Git to
  `/data/flexbox/backups/postgres` with mode `0600` and a SHA-256 sidecar.
- The archive was read successfully with `pg_restore --list`.
- Database `flexbox_linktree` was created with owner `flexbox_app`.
- Role `flexbox_app` exists with login enabled and superuser, createdb,
  createrole, replication, and bypassrls all disabled.
- A connection test as `flexbox_app` succeeded.
- No production migration or seed was run.
- Host port 5432 remains absent and PostgreSQL remains on the private `coolify`
  network.

## Application and storage result

- One Coolify application was created; no duplicate was found.
- Application creation used the official public-repository endpoint and did not
  trigger deployment.
- Media file storage was created with host directory
  `/data/flexbox/media`, container path `/data/flexbox/media`, and
  `is_directory=true`.
- Required application configuration was added through Coolify environment
  management. Secret values are hidden and are not recorded here.
- Nixpacks Node/build overrides were added using documented Nixpacks variables.
- Deployment history is empty and no application container exists.

## Pending validation and owner gates

- Host media ownership remains `root:root` mode `0750`; runtime UID/GID access
  cannot be proven until a non-production deployment creates the container.
- Node/pnpm test suite and build were not run on the host because Node and pnpm
  are not installed there. No server-wide runtime installation was performed.
- Resend sender verification and API key remain pending.
- Staging deployment and verification remain pending.
- Production migration, first public deployment, HTTPS, DNS/NAT cutover, and
  real email delivery still require their separate owner approvals.

## Final state

**PHASE 8H: RESOURCE PROVISIONING COMPLETE — APPLICATION NOT YET DEPLOYED**

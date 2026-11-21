# Phase 8X — Production Migration Execution Report

Status: BLOCKED — MIGRATION NOT EXECUTED

Execution date: 2026-11-21 UTC

## Approval and scope

Owner approval for the production migration was received in the Phase 8X
instruction. The approved scope excludes production seed, admin bootstrap,
application deployment, email, DNS/NAT/firewall/SSH changes, and destructive
resource operations. None of those excluded actions were performed.

## Target verification — PASS

- Coolify PostgreSQL resource: `aswul0ozryb1hxawjfzjsnwj`.
- PostgreSQL version: 17.12.
- Database target: `flexbox_linktree`.
- Staging database: `flexbox_linktree_staging` (separate).
- Application role: `flexbox_app`.
- Database container: healthy.
- Host port 5432: not published.
- `flexbox_app` is login-enabled but not superuser, CREATEDB, CREATEROLE,
  replication, BYPASSRLS, or a member of another role.
- The application role has CONNECT and public schema USAGE/CREATE privileges,
  which are required for the initial schema migration.

## Migration inventory — PASS

Production was rechecked and still has no `_prisma_migrations` table and no
public application tables. Staging has 10 finished migrations and zero failed
or pending migrations. The pending production sequence is:

1. `20261114114846_init`
2. `20261115061934_add_content_cms_foundation`
3. `20261115081603_add_admin_identity_security`
4. `20261115081700_add_admin_identity_checks`
5. `20261115110654_add_cms_audit_events`
6. `20261115142019_add_analytics_events`
7. `20261115142500_add_analytics_checks`
8. `20261115143000_add_analytics_event_day`
9. `20261115161000_relax_lifecycle_clock_skew`
10. `20261115170000_add_admin_account_deleted_event`

No migration SQL was edited, created, reset, or run against production.

## Final backup — PASS

- Backup: `/data/flexbox/backups/postgres/flexbox_linktree-phase8x-pre-migration-20261121T085454Z.dump`.
- Format: PostgreSQL custom format from PostgreSQL 17.12.
- Permission: 0600.
- SHA-256 sidecar: valid.
- `pg_restore --list`: valid.
- Restore verification into a disposable PostgreSQL 17 instance: PASS.
- Previous backups were preserved.

## Migration execution blocker and safe resolution

The required production `DATABASE_URL` is stored as a protected Coolify
environment variable with `is_shown_once=true`. Coolify's API/response does
not return its value, and the host has no installed Coolify CLI execution path.
There is currently no production application container from which Coolify
could inject that secret. The migration was therefore not started.

Using the database superuser password from the PostgreSQL container, guessing
the application password, reading Coolify's internal database, or changing
the production secret would violate the execution safety requirements and was
not attempted.

A root-only owner-run helper was prepared at
`/root/.config/flexbox/phase8x-migrate-secure.sh` (mode 0700). It reads the
existing production URL from hidden stdin, rejects staging/Coolify/localhost
targets, passes the URL to a child shell through stdin rather than Docker
arguments or an environment-at-create-time, runs Node.js 24 with pnpm
12.18.0 on the `coolify` network, redacts connection URLs in output, and
removes its temporary dependency volume on exit. The helper itself contains
no credential.

## Not run

- `pnpm db:migrate:deploy` — NOT RUN.
- Production seed — NOT RUN.
- Admin bootstrap — NOT RUN.
- Production deployment/container startup — NOT RUN.
- Email/DNS/NAT/firewall/SSH changes — NOT RUN.

## Required owner action

Run the prepared helper directly on the VPS, using the existing production
`DATABASE_URL` from the Coolify secret store or the owner's secure password
manager. Do not paste the URL into chat:

```text
/root/.config/flexbox/phase8x-migrate-secure.sh
```

Once that owner-run command completes successfully, rerun the final target
check and execute only:

```text
pnpm db:migrate:deploy
```

Then verify all 10 migrations, schema, role privileges, and staging
isolation. Do not run seed, bootstrap, or deployment in the same action.

# Phase 8P — Production Migration Report

Status: BLOCKED — OWNER APPROVAL REQUIRED

Production migration was intentionally not executed. The approval gate is
still required.

## Target and backup

- Coolify PostgreSQL resource: `aswul0ozryb1hxawjfzjsnwj`.
- Target database: `flexbox_linktree`.
- Target role: `flexbox_app`.
- PostgreSQL: 17.12; host port 5432 remains private.
- Fresh backup: `/data/flexbox/backups/postgres/flexbox_linktree-pre-migration-20261121T082525Z.dump`.
- Backup mode: custom format, mode 0600, root-owned.
- SHA-256 sidecar verification: PASS.
- `pg_restore --list`: PASS using PostgreSQL 17 utilities.
- Restore to disposable PostgreSQL 17: PASS; no production database was
  overwritten or modified.

## Migration review

All 10 repository migrations are pending in production. Staging applied all
10 successfully:

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

The SQL review found additive table/type/index/constraint changes and enum
value additions. No `DROP`, `DELETE`, `TRUNCATE`, or destructive reset command
was found. Production currently has no `_prisma_migrations` table and no
public application tables, so the target is an empty database. This lowers
data-lock risk but does not remove the need for an owner-approved release.

## Rollback and approval

Prisma migrations are normally forward-only. Rollback is therefore:

1. stop or isolate application traffic if a migration/runtime incompatibility
   appears;
2. preserve the failed database and logs;
3. apply a reviewed forward-fix migration, or restore the verified pre-release
   archive to a separately named recovery database and perform a controlled
   cutover only after approval.

Expected first-release impact: migration is against an empty database, but
application deployment remains unavailable until the schema exists. No
production migration command has been run. Approval is required before
running exactly `pnpm db:migrate:deploy` against this target.

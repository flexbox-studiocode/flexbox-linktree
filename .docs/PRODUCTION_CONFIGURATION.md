# Production Configuration and Preflight

Milestone G deliverable. This file documents the settings required before a
Phase 8 staging/production release and the local preflight command. It does not
contain actual credential values.

## 1. Preflight command

```powershell
# Checks current local configuration; loads .env.local if present.
pnpm config:check

# Force production rules against current process environment.
pnpm config:check --production

# Recommended: validate a protected staging file without committing it.
pnpm config:check --env-file .env.staging --production
```

Exit status:

- `0`: no blocking configuration error. Warnings still require operator review.
- `1`: one or more production blockers. Do not deploy.

The command reports variable names and secret lengths only, never secret
contents. Environment variables already exported to the process take precedence
over values in `--env-file`. Do not pass secrets as command-line values.

## 2. Required production configuration

| Variable | Required | Rule |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL URL to private/internal or managed DB. No localhost. Do not expose PostgreSQL publicly. |
| `NEXTAUTH_URL` | Yes | Canonical HTTPS origin, no path/query/fragment. |
| `NEXTAUTH_SECRET` or `AUTH_SECRET` | Yes | At least 32 characters, cryptographically random, unique per environment. Set only one where practical. |
| `RATE_LIMIT_SECRET` | Yes | Dedicated, random secret, at least 32 characters; must differ from session secret. |
| `ANALYTICS_HASH_SECRET` | Recommended | Dedicated secret of at least 16 characters; do not reuse session or rate-limit key. Analytics falls back to session key if absent. |
| `MEDIA_STORAGE_DRIVER` | Yes | `s3` in production. Local filesystem is ephemeral and rejected by preflight. |
| `S3_BUCKET` | Yes | Production bucket name. |
| `S3_ACCESS_KEY_ID` | Yes | Least-privilege object-storage credential. Prefer workload identity if provider supports it. |
| `S3_SECRET_ACCESS_KEY` | Yes | Secret counterpart; rotate through storage provider, not repository. |
| `S3_REGION` | Recommended | Defaults to `us-east-1`; set explicit provider region. |
| `S3_ENDPOINT` | Conditional | Required for non-AWS S3-compatible storage. Use HTTPS endpoint. |
| `S3_PUBLIC_URL` | Conditional | Public media origin only if assets are served through a public URL/CDN. |
| `ADMIN_MAIL_TRANSPORT` | Yes | Must be a real production provider. `file` does not send email and blocks recovery/invitations. **No provider is implemented yet**; this is a launch blocker. |
| `ANALYTICS_RAW_RETENTION_DAYS` | Optional | Code default 90 days; approved range 1–365. Must match privacy decision. |
| `ANALYTICS_AGGREGATE_RETENTION_DAYS` | Optional | Code default 400 days; approved range 90–1095. |
| `TRUST_PROXY_HEADERS` | Conditional | Set `true` only behind a trusted proxy that overwrites `x-forwarded-for` and `x-real-ip`; otherwise leave unset. |

Set `NODE_ENV=production` through the process manager/runtime. Never use
`NEXT_PUBLIC_` for secrets. `.env.example` contains placeholders only.

## 3. Production release checklist

### Identity, access, and mail

- [ ] Provision first administrator through the protected operator CLI; disable
  `ADMIN_BOOTSTRAP_ENABLED` immediately afterwards.
- [ ] Confirm only explicitly allowlisted active Flexbox members hold
  `SUPER_ADMIN`.
- [ ] Set unique session, rate-limit, and analytics secrets. Store in the
  production secret manager; restrict read access to deployment operators.
- [ ] Integrate and test real mail provider for invitation and password recovery.
  Current `getAdminMailer()` supports only development file transport; **do not
  launch while this remains unresolved**.
- [ ] Run login lockout, `authVersion` revocation, reset-token expiry, and
  self-lockout tests against staging.

### Database and backup

- [ ] Provision PostgreSQL 17 on private network; TLS in transit and encryption
  at rest enabled.
- [ ] Apply reviewed migrations with `pnpm db:migrate:deploy`; never run
  `prisma migrate dev` against production.
- [ ] Schedule encrypted off-host backups, verify checksum, and complete restore
  drill. Record agreed RPO/RTO. See `.docs/DATABASE_BACKUP_RECOVERY.md`.
- [ ] Confirm connection pool limits and monitoring; no public port binding.
- [ ] Keep database backups and object-storage media backups separately.

### Media and content

- [ ] Configure S3-compatible bucket, TLS endpoint, least-privilege credentials,
  CORS/public delivery policy, lifecycle rules, and backup/versioning.
- [ ] Set production domain, confirmed contact channel, and owner-approved
  directory destinations. The current seed contains no confirmed destinations;
  cards remain non-interactive until content is approved.
- [ ] Verify published/active content only is public; check the safe redirect and
  reject arbitrary URLs.
- [ ] Confirm CSP, HSTS, `nosniff`, `frame-ancestors`, private CMS cache headers,
  and HTTPS at the external proxy. CSP still allows `'unsafe-inline'`; review
  residual risk in `.docs/SECURITY_REVIEW.md`.

### Analytics, privacy, and operations

- [ ] Approve privacy disclosure and retention policy before collecting real
  traffic. Set retention variables and schedule `pnpm analytics:cleanup`.
- [ ] Confirm analytics excludes administrators and known bots as configured;
  reconcile daily rollups with raw events during staging.
- [ ] Set trusted proxy policy deliberately. Without trusted client addresses,
  login throttling applies only per account; per-source throttle is unavailable.
- [ ] Configure logs/metrics, alerting, incident contact, uptime checks, and
  maintenance mode at the reverse proxy. Do not log tokens, raw IPs, passwords,
  event payloads, or database URLs.
- [ ] Capture staging perf baseline; local loopback results are not production
  capacity evidence.

### Release execution

- [ ] CI green on exact release commit, including frozen install, schema,
  migration deploy, lint, types, tests, build, production audit, secret scan.
- [ ] `pnpm config:check --env-file <protected-file> --production` reports zero
  errors; each warning reviewed and recorded.
- [ ] Run `pnpm qa:e2e`, `pnpm qa:a11y`, `pnpm qa:visual`, `pnpm perf:smoke` on
  staging origin.
- [ ] Backup + isolated restore check passes for release DB.
- [ ] Verify admin sign-in, published public page, safe redirect, analytics, mail
  recovery, S3 media, robots/indexing, security headers, and rollback procedure.
- [ ] Owner explicitly approves production release. No deployment is authorized
  by this document.

## 4. Preflight test evidence

Executed on 2026-11-17:

- `pnpm config:check`: **0 errors, 0 warnings** for the local development
  configuration.
- `pnpm config:check --production`: **9 errors, 1 warning** because local
  development configuration is not production-ready (no prod URL/secrets/S3/mail).
- A temporary, deliberately unsafe env fixture produced **12 errors, 3
  warnings**, covering localhost DB, placeholder/short secrets, HTTP origin,
  local media, enabled bootstrap, file mail, and trusted proxy. The fixture was
  stored under the approved temp directory and deleted after the check.

Production preflight correctly blocks current configuration. This is expected,
not a failed release check.

## 5. Current launch blockers

1. No real transactional email provider exists; password recovery and
   invitations cannot be delivered in production.
2. No production domain, infrastructure, S3 configuration, or staging
   environment exists yet.
3. Owner has not confirmed directory destinations, public contact channel,
   analytics disclosure, or final public domain.
4. No owner-approved production RPO/RTO and off-host backup target.

These gaps must be resolved during Phase 8 before production deployment.
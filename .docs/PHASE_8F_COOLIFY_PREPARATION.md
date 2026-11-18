# Phase 8F Coolify Preparation

Status: **NOT YET DEPLOYED**

The Coolify application resource has not been created and no deployment was
started.

## Application definition

- Repository: `https://github.com/flexbox-studiocode/flexbox-linktree`
- Branch: `main`
- Runtime: Node.js 24
- Package manager: pnpm 12.18.0
- Internal port: `3000`
- Start command: `pnpm start`
- Health check: `GET /api/health`
- Canonical domain: `https://microsite.flexbox.web.id`
- WWW alias: `https://www.microsite.flexbox.web.id`
- Persistent container path: `/data/flexbox/media`

Build sequence:

```text
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
```

`pnpm db:migrate:deploy` must remain a reviewed pre-deploy operation and must
not be included in the image build.

## Required environment categories

- Private Coolify PostgreSQL connection string.
- One session secret and a dedicated rate-limit secret.
- `NEXTAUTH_URL=https://microsite.flexbox.web.id`.
- Local persistent media variables documented in Phase 8E.
- Resend variables only after sender verification:

  ```text
  ADMIN_MAIL_TRANSPORT=resend
  EMAIL_FROM=noreply@mail.microsite.flexbox.web.id
  RESEND_SENDER_VERIFIED=true
  RESEND_API_KEY=<Coolify secret>
  ```

No production secrets are present in the repository.

## Manual prerequisites

1. Create private PostgreSQL 17 in Coolify without publishing 5432.
2. Create the application resource from `main`.
3. Mount host `/data/flexbox/media` to the same container path.
4. Set the runtime UID/GID permissions for that mount.
5. Confirm NAT 80/443 and DNS/HTTPS readiness.
6. Verify Resend sender domain and add provider-issued DNS records.
7. Obtain owner approval before migration, email delivery, or production
   cutover.

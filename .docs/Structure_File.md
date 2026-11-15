# Repository Structure Specification

**Project:** Flexbox Linktree  
**Status:** Proposed structure for implementation  
**Language:** English

## 1. Structure Principles

- Keep public UI, admin UI, business logic, infrastructure, and database schema clearly separated.
- Organize by product feature/domain where appropriate.
- Keep Next.js route files thin; business rules belong in feature/service modules.
- Use Server Components by default and Client Components only for interactive UI.
- Keep secrets, local data, generated files, and production uploads out of Git.
- Preserve the existing `.docs/Desain.md` and `.flexbox/LogoFlexBox.png` assets.

## 2. Proposed Repository Tree

The tree below is the **target structure** for the full product. Sections marked "current" describe what exists after Phase 3.

### 2.1 Current state (after Phase 3)

```text
flexbox-linktree/
├── .docs/                       # normalized documentation
│   ├── DATABASE_SCHEMA.md       # Phase 3 content schema, constraints, seed, lifecycle
│   ├── PUBLIC_PAGE.md           # public page + content model reference
│   └── ... (PRD, Architecture, Desain, Tech-Stack, Roadmap, Structure_File, LOCAL_DEVELOPMENT)
├── .local-storage/              # git-ignored local backups/probes
├── .flexbox/LogoFlexBox.png     # original brand source asset
├── prisma/
│   ├── schema.prisma            # SystemCheck + content domain
│   ├── migrations/              # init, add_content_cms_foundation
│   ├── seed.ts                  # idempotent upsert runner
│   ├── seed-data.ts             # canonical development dataset
│   └── check.ts                 # local connectivity/query check
├── public/assets/flexbox-logo.png
├── scripts/
│   ├── visual-qa.mjs            # viewport screenshots + overflow/console/network checks
│   ├── a11y-audit.mjs           # landmarks, names, contrast, focus, reduced motion
│   └── a11y-interaction.mjs     # 200% zoom, anchor offsets, tab order
├── tests/
│   ├── setup.ts                 # loads .env.local for integration tests
│   ├── stubs/                   # server-only + next/cache test doubles
│   ├── helpers/                 # local-db guard + record fixtures
│   ├── unit/
│   │   ├── url.test.ts              # destination-scheme rules
│   │   ├── content-schemas.test.ts  # category/link/destination/settings validation
│   │   ├── public-content.mapper.test.ts    # DTO mapping + destination resolution
│   │   ├── public-content.service.test.ts   # composition, fallbacks, empty states
│   │   ├── seed-data.test.ts        # seed dataset contracts
│   │   ├── password.test.ts         # Argon2id parameters, verification, rehash
│   │   ├── security-tokens.test.ts  # opaque tokens + HMAC buckets
│   │   ├── callback-url.test.ts     # post-login redirect allowlist
│   │   ├── login-schema.test.ts     # credential form contract
│   │   └── proxy-gate.test.ts       # fail-closed middleware gate
│   └── integration/
│       ├── content-repository.test.ts   # publication filters against local PostgreSQL
│       ├── admin-provisioning.test.ts   # bootstrap, invitation, acceptance
│       ├── admin-authentication.test.ts # Argon2id sign-in + throttling
│       ├── admin-authorization.test.ts  # token-to-row authorization
│       └── admin-lifecycle.test.ts      # status, password change, reset
├── src/
│   ├── app/
│   │   ├── layout.tsx           # fonts, metadata, viewport, lang
│   │   ├── page.tsx             # public route; loads content from PostgreSQL
│   │   ├── globals.css          # design tokens + public stylesheet
│   │   ├── icon.png             # favicon from brand logo
│   │   ├── api/auth/            # Auth.js route handler
│   │   ├── admin/
│   │   │   ├── login/           # public sign-in page + form
│   │   │   ├── forgot-password/ # public recovery request
│   │   │   ├── reset-password/  # public token completion
│   │   │   └── (protected)/     # requireAdmin() gate, landing page, security page
│   │   └── robots.ts            # /robots.txt
│   ├── components/public/
│   │   ├── site-header.tsx      # takes `site` props
│   │   ├── hero.tsx             # takes `site` props
│   │   ├── directory.tsx        # takes `categories` props
│   │   ├── link-card.tsx        # takes a PublicLink
│   │   ├── link-icon.tsx        # inline outline SVG icon set
│   │   ├── contact-cta.tsx      # takes `site` props
│   │   └── site-footer.tsx      # takes `site` + `year` props
│   ├── features/
│   │   ├── content/
│   │   │   ├── constants.ts     # approved public anchors
│   │   │   ├── fallbacks.ts     # documented branding fallback (no link data)
│   │   │   ├── mappers/         # Prisma record -> public DTO
│   │   │   ├── repositories/    # server-only Prisma queries
│   │   │   ├── schemas/         # Zod validation
│   │   │   ├── services/        # cached public content composition
│   │   │   └── types/           # public DTO contracts
│   │   ├── auth/
│   │   │   ├── actions/         # Server Actions (password change)
│   │   │   ├── cli/             # bootstrap, invite, accept, status, cleanup
│   │   │   ├── repositories/    # server-only admin queries
│   │   │   ├── schemas/         # login + identity validation
│   │   │   ├── services/        # authentication, authorization, lifecycle
│   │   │   └── types/           # admin session DTOs
│   │   └── public/
│   │       └── copyright.ts     # stable copyright year
│   ├── generated/prisma/        # generated Prisma Client (git-ignored)
│   ├── lib/
│   │   ├── auth/                # Auth.js options, session guards, cookies
│   │   ├── mail/                # admin mail interface + development transport
│   │   ├── prisma/client.ts
│   │   ├── security/            # Argon2id, token hashing, client source
│   │   ├── system-check.ts
│   │   └── utils/url.ts
│   └── types/
│       └── next-auth.d.ts       # session/JWT augmentation
├── src/proxy.ts                 # optimistic admin gate (not authorization)
├── AGENTS.md
├── README.md
├── docker-compose.yml
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── prisma7.config.ts            # Prisma 7 CLI configuration (+ seed command)
├── tsconfig.json
├── vitest.config.mts
├── .env.example
├── .nvmrc
└── .gitignore
```

Phase 4 added `src/features/auth`, `src/lib/auth`, `src/lib/security`, `src/lib/mail`, `src/app/admin`, `src/app/api/auth`, and `src/proxy.ts`. Phase 5 added `src/components/admin`, the protected CMS routes under `src/app/admin/(protected)`, `src/features/admin`, `src/features/media`, `src/lib/storage`, and the media serving route `src/app/media/[...key]`. Robust media binaries are not stored in PostgreSQL. Phase 6 adds the analytics modules. The public presentation components already consume typed DTO props, so CMS work does not require rewriting them.

### 2.2 Target structure

```text
flexbox-linktree/
├── .docs/
│   ├── Desain.md
│   ├── Architecture.md
│   ├── PRD.md
│   ├── Roadmap.md
│   ├── Tech-Stack.md
│   ├── Structure_File.md
│   └── LOCAL_DEVELOPMENT.md
│
├── .flexbox/
│   └── LogoFlexBox.png
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── public/
│   ├── favicon.ico
│   ├── robots.txt
│   └── assets/
│       └── flexbox-logo.png
│
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── loading.tsx
│   │   │
│   │   ├── admin/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── (protected)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── links/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── new/page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── categories/page.tsx
│   │   │   │   ├── media/page.tsx
│   │   │   │   ├── settings/page.tsx
│   │   │   │   ├── analytics/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── links/page.tsx
│   │   │   │   │   └── audience/page.tsx
│   │   │   │   ├── admins/page.tsx
│   │   │   │   └── audit-logs/page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── analytics/page-view/route.ts
│   │   │   ├── analytics/click/[linkId]/route.ts
│   │   │   └── health/route.ts
│   │   │
│   │   ├── globals.css
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── public/
│   │   │   ├── header.tsx
│   │   │   ├── hero.tsx
│   │   │   ├── directory.tsx
│   │   │   ├── link-card.tsx
│   │   │   ├── contact-cta.tsx
│   │   │   └── footer.tsx
│   │   ├── admin/
│   │   │   ├── sidebar.tsx
│   │   │   ├── admin-header.tsx
│   │   │   ├── data-table.tsx
│   │   │   ├── status-badge.tsx
│   │   │   └── analytics/
│   │   └── shared/
│   │       ├── form-field.tsx
│   │       ├── confirm-dialog.tsx
│   │       └── empty-state.tsx
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── actions/
│   │   │   ├── services/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   ├── links/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   ├── services/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   ├── categories/
│   │   ├── settings/
│   │   ├── media/
│   │   └── analytics/
│   │       ├── collectors/
│   │       ├── queries/
│   │       ├── services/
│   │       ├── schemas/
│   │       └── types.ts
│   │
│   ├── lib/
│   │   ├── auth/
│   │   ├── prisma/
│   │   ├── storage/
│   │   ├── validation/
│   │   ├── security/
│   │   ├── analytics/
│   │   ├── env/
│   │   └── utils/
│   │
│   └── types/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── .dockerignore
├── .env.example
├── .gitignore
├── .nvmrc
├── AGENTS.md
├── Dockerfile
├── docker-compose.yml
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── prisma7.config.ts
├── README.md
└── tsconfig.json
```

Notes:

- Tailwind CSS v4 in this project is integrated through `@tailwindcss/turbopack` and `next.config.ts`, so a separate `postcss.config.mjs` is not required and is not present.
- The Prisma CLI configuration file is `prisma7.config.ts`, not `prisma.config.ts`, because Prisma 7 uses the versioned config filename by default.

This is a target structure, not a claim that these files already exist. Add directories when the corresponding feature is implemented; do not create dozens of empty files solely to match the diagram.

## 3. Directory Responsibilities

### `.docs/`
Product, design, architecture, roadmap, stack, and local setup documentation. `Desain.md` remains the visual reference for the public page.

### `.flexbox/`
Original Flexbox brand assets and internal reference material. Copy approved web-ready assets into `public/assets/` when needed; preserve the original source asset.

### `prisma/`
Prisma schema, committed database migrations, and development seed data. Never place production database dumps or secrets here.

### `src/app/`
Next.js route definitions, layouts, loading/error boundaries, and narrow route handlers. Keep page components focused on composition and data loading.

### `src/components/`
Reusable presentation components. Separate public and admin components because their visual systems and interaction requirements differ.

### `src/features/`
Domain-oriented application logic. The `content` feature owns schemas, repositories, mappers, services, and types for the public content layer. The `auth` feature owns administrator schemas, repositories, services, Server Actions, operator CLIs, and session DTOs. Future features (`media`, `analytics`) will be added alongside them.

### `src/lib/`
Shared infrastructure adapters and cross-cutting concerns: Auth.js configuration and session guards, the Prisma singleton/client, mail delivery, token and password security helpers, client-source derivation, storage, environment validation, and utilities.

### `src/proxy.ts`
The optimistic admin gate. It verifies the JWT signature and redirects unauthenticated visitors, but it never replaces the database-backed authorization checks in services and Server Actions.

### `tests/`
Unit tests for pure logic, integration tests for database-backed services, and end-to-end tests for public/admin journeys.

### `.github/workflows/`
Continuous integration checks such as install, lint, typecheck, tests, and build. Deployment workflows must not expose secrets or bypass release approval.

## 4. Naming Conventions

- Components: PascalCase filenames where the repository convention supports it, otherwise consistent kebab-case; do not mix styles arbitrarily.
- Functions and variables: camelCase.
- Types and interfaces: PascalCase.
- Database models: PascalCase singular; database table/column mapping may use snake_case consistently.
- Environment variables: UPPER_SNAKE_CASE.
- Route segments: lowercase kebab-case.
- Feature directories: lowercase plural or domain name, used consistently.

## 5. Files That Must Not Be Committed

At minimum, ignore:

```gitignore
node_modules/
.next/
out/
build/
coverage/
.env
.env.*
!.env.example
*.log
.DS_Store
Thumbs.db
```

Also ignore local-only database dumps, temporary uploads, generated secrets, and storage directories unless a specific fixture is intentionally committed. Do not ignore Prisma migrations or the pnpm lockfile.

Additionally ignored in this repository: `src/generated/prisma/` (generated Prisma Client), `storage/uploads/` (local media), `.local-storage/`, `*.tsbuildinfo`, `next-env.d.ts`, and local database dumps (`*.dump`, `*.sql.gz`).

## 6. Import and Dependency Rules

- Use the configured `@/` alias consistently.
- Avoid circular dependencies between feature modules.
- Domain features may depend on shared `lib` infrastructure; `lib` must not import UI components.
- Keep Prisma calls inside server-only query/service modules.
- Do not import server-only modules into Client Components.
- Do not place secrets or database clients in files marked with `"use client"`.
- Keep public components independent of admin navigation and admin-only data.
- Use the public DTO types in `src/features/content/types/public-content.ts` for all component props that represent published content; do not pass Prisma model types into components.

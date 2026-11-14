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

The tree below is the **target structure** for the full product. Sections marked "current" describe what exists after Phase 1.

### 2.1 Current state (after Phase 1)

```text
flexbox-linktree/
├── .docs/                       # normalized documentation (Phase 0)
├── .flexbox/LogoFlexBox.png     # original brand source asset
├── prisma/
│   ├── schema.prisma            # Prisma 7 schema, SystemCheck model
│   ├── migrations/              # committed migrations (init)
│   └── check.ts                 # local connectivity/query check
├── public/assets/flexbox-logo.png
├── scripts/readiness.test.ts    # foundation unit test
├── src/
│   ├── app/                     # layout.tsx, page.tsx, globals.css
│   ├── components/
│   ├── features/
│   ├── generated/prisma/        # generated Prisma Client (git-ignored)
│   ├── lib/
│   │   ├── prisma/client.ts
│   │   └── system-check.ts
│   └── types/
├── AGENTS.md
├── README.md
├── docker-compose.yml
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── prisma7.config.ts            # Prisma 7 CLI configuration
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── .nvmrc
└── .gitignore
```

`src/components` and `src/features` exist with a `.gitkeep` and their intended purpose documented; they are created now so feature work does not restructure the tree mid-phase.

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
Domain-oriented application logic. Each feature owns its validation schemas, services, queries, and actions where applicable.

### `src/lib/`
Shared infrastructure adapters and cross-cutting concerns: Auth.js, Prisma singleton/client, storage, environment validation, authorization, security, and utilities.

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

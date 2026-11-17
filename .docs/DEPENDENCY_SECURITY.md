# Dependency Security and Supply Chain

Phase 7 — Milestone C record. Applies to the repository at the commit that
introduced this document and supersedes nothing: it records the current
dependency posture, the remediation applied, and the rules for future updates.

## 1. Policy

- Runtime dependencies are pinned to exact versions. Development tooling may use
  caret ranges only where the tool is not part of the shipped artifact.
- Only stable releases are adopted. No release candidate, beta, canary, or
  experimental build is used in production paths. This is why Prisma 8
  (`8.0.0-rc.33`) and TypeScript 7 (`7.0.2`) are not adopted.
- `pnpm-lock.yaml` is committed and CI installs with `--frozen-lockfile`.
- Install scripts are deny-by-default through `allowBuilds` in
  `pnpm-workspace.yaml`. Only packages whose postinstall is reviewed
  (`@prisma/engines`, `esbuild`, `prisma`) may run them.
- Every dependency change must pass `pnpm lint`, `pnpm typecheck`, `pnpm test`
  (including database integration tests), and `pnpm build` before it is
  committed.
- Production audits run at `--prod --audit-level=high` in CI. Development-only
  advisories are still tracked and remediated when a compatible patch exists.

## 2. Baseline audit

Before remediation, `pnpm audit --audit-level=low` reported one advisory:

| Advisory | Severity | Package | Scope | Path |
|---|---|---|---|---|
| `GHSA-g3hv-75wg-m249` (globparts amplification DoS) | Moderate | `minimatch` `>=7.0.0 <11.0.1` | Development only | `eslint-config-next` → `typescript-eslint` → `@typescript-eslint/typescript-estree` → `minimatch` |

All 11 affected paths were under the ESLint toolchain. No production dependency
was affected. `pnpm audit --prod` was clean at baseline.

## 3. Remediation applied

### 3.1 Patched transitive dependency

`pnpm-workspace.yaml` now carries an override:

```yaml
overrides:
  "minimatch@<11.0.1": 11.0.1
```

This forces every transitive `minimatch` request below the patched floor to
`11.0.1`. `pnpm why minimatch` confirms a single resolved version, and
`pnpm lint` still passes, so the major bump does not break the ESLint chain in
this project. The override is intentionally narrow: it applies only to the
vulnerable range and disappears automatically once parents raise their own
floor.

Note: pnpm 12 no longer reads the `pnpm` field in `package.json`; overrides
belong in `pnpm-workspace.yaml`. An initial attempt in `package.json` was
rejected by pnpm with a warning and was moved.

### 3.2 Patch upgrades

| Package | From | To | Reason |
|---|---|---|---|
| `react` | 19.3.0 | 19.3.1 | Patch release; runtime dependency. |
| `react-dom` | 19.3.0 | 19.3.1 | Matches `react`. |
| `tailwindcss` | 4.3.3 | 4.3.5 | Patch release; styling pipeline. |
| `@tailwindcss/turbopack` | 4.3.3 | 4.3.5 | Must match `tailwindcss`. |
| `playwright-core` | 1.65.0 | 1.65.1 | Patch release; QA scripts only. |

## 4. Deferred upgrades

These are available but deliberately not adopted in Phase 7. Each is a major
version or an unsupported-at-release candidate and would widen the release
surface without a security driver.

| Package | Current | Available | Reason deferred |
|---|---|---|---|
| `eslint` | 9.39.5 | 10.15.0 | Major; `eslint-config-next` targets ESLint 9. Revisit with the framework's next release. |
| `typescript` | 5.9.3 | 7.0.2 | Major; the codebase and Next.js type plugin target TypeScript 5. |
| `prisma` / `@prisma/client` / `@prisma/adapter-pg` | 7.10.1 | `8.0.0-rc.33` | Release candidate only. Production policy forbids RC builds. |
| `@types/node` | 24.19.2 | 26.6.6 | Major; runtime floor is Node 24+, and the types must match the supported API surface actually used. |
| `pnpm` | 12.18.0 | 12.21.0 | Minor tool upgrade; pinned through `packageManager` for reproducibility. Upgrade intentionally with a lockfile refresh, not silently. |

## 5. Supply-chain controls in place

- **Frozen installs**: CI and release steps run `pnpm install --frozen-lockfile`.
- **Build-script allowlist**: `allowBuilds` in `pnpm-workspace.yaml`.
- **Production audit**: CI job `supply-chain` fails on high/critical production
  advisories.
- **Secret scan**: CI greps tracked files for private keys, AWS access key IDs,
  and inline `NEXTAUTH_SECRET` / `DATABASE_URL` values. `.env.example` and lock
  files are excluded because they contain placeholders or public integrity
  hashes.
- **No public registry substitution**: no custom registry or tarball URL is
  configured in `.npmrc`. If one is added for a corporate mirror, pin it in the
  same change and document it here.
- **Runtime pinning**: the shipped surface is `next`, `react`, `react-dom`,
  `next-auth`, `zod`, `@node-rs/argon2`, `@prisma/*`, and `server-only`; all are
  exact-pinned except `@node-rs/argon2` (`^2.2.2`) and `server-only`
  (`^0.0.1`), which are stable single-purpose packages.

## 6. Verification performed for this change

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Passed (lockfile consistent after upgrade). |
| `pnpm audit --audit-level=low` | `No known vulnerabilities found`. |
| `pnpm audit --prod --audit-level=low` | `No known vulnerabilities found`. |
| `pnpm lint` | Passed, no findings. |
| `pnpm typecheck` | Passed. |
| `pnpm test` | 27 files / 286 tests passed against local PostgreSQL. |
| `pnpm build` | Passed. |
| `pnpm outdated` | Only deferred majors remain (see §4). |

## 7. Maintenance rule

1. Re-run `pnpm audit` and `pnpm outdated` at the start of every phase.
2. Apply patch updates immediately when they are in-range and the full check
   suite passes.
3. For a transitive advisory, prefer a parent upgrade; use a narrow override
   only when no compatible parent release exists, and remove the override once
   the parent catches up.
4. Never adopt a prerelease for a production dependency without an explicit
   owner decision recorded in `.docs/Architecture.md`.
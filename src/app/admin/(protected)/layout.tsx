import Link from "next/link";
import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { requireAdmin } from "@/lib/auth/session";

/**
 * Authenticated pages must not be prerendered.
 *
 * Every route under this layout reads the session cookie and queries the
 * administrator row, so `next build` cannot produce a static shell for them.
 * `instant = false` marks the segment as intentionally blocking (documented
 * Cache Components behaviour) instead of streaming a shell that would have to be
 * rendered before authorization is known.
 *
 * This is not a security control on its own: `requireAdmin()` below is.
 */
export const instant = false;

/**
 * Server-side authorization gate and shell for every protected admin page.
 *
 * This layout re-reads the account and checks ACTIVE + SUPER_ADMIN + matching
 * `authVersion`; it does not rely on the optimistic `src/proxy.ts` redirect.
 * Server Actions and Route Handlers must call `requireAdminAction()` or
 * `requireSuperAdmin()` themselves: a layout only gates page rendering.
 */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
        href="#admin-content"
      >
        Lewati ke konten utama
      </a>

      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link className="flex items-baseline gap-2" href="/admin">
            <span className="text-base font-bold tracking-tight text-[var(--ink)]">Flexbox Studio</span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">CMS</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              className="hidden min-h-11 items-center rounded-[var(--radius)] px-3 text-sm font-semibold text-[var(--blue-strong)] hover:bg-[var(--blue-soft)] sm:inline-flex"
              href="/"
              target="_blank"
              rel="noreferrer"
            >
              Lihat situs publik
            </Link>
            <span className="hidden text-xs leading-5 text-[var(--muted)] sm:block">
              {admin.name}
              <br />
              {admin.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8">
        <div className="lg:w-52 lg:shrink-0">
          <AdminNav />
        </div>

        <main className="min-w-0 flex-1 pb-16" id="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
import type { ReactNode } from "react";

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
 * Server-side authorization gate for every protected admin page.
 *
 * This layout re-reads the account and checks ACTIVE + SUPER_ADMIN + matching
 * `authVersion`; it does not rely on the optimistic `src/proxy.ts` redirect.
 * Server Actions and Route Handlers must call `requireAdminAction()` or
 * `requireSuperAdmin()` themselves: a layout only gates page rendering.
 */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)]">
      {children}
    </div>
  );
}

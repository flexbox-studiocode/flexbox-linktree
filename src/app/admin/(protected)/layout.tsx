import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth/session";

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

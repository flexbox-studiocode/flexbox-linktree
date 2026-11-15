import { requireAdmin } from "@/lib/auth/session";

/** Phase 4 landing page. CMS CRUD begins in Phase 5. */
export default async function AdminHomePage() {
  const admin = await requireAdmin();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16 sm:px-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">
        Flexbox Studio · Admin
      </p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
        Welcome, {admin.name}.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--color-muted)]">
        Your administrator identity is authenticated and authorized. Content
        management is intentionally reserved for Phase 5.
      </p>
      <div className="mt-10 rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm sm:p-8">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Account
            </dt>
            <dd className="mt-2 break-all text-sm font-medium">{admin.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Role
            </dt>
            <dd className="mt-2 text-sm font-medium">{admin.role}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}

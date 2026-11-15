import Link from "next/link";

import { requireAdmin } from "@/lib/auth/session";

import { SignOutButton } from "./sign-out-button";

/** Phase 4 landing page. CMS CRUD begins in Phase 5. */
export default async function AdminHomePage() {
  const admin = await requireAdmin();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16 sm:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Flexbox Studio · Admin
        </p>
        <div className="flex items-center gap-3">
          <Link
            className="min-h-11 inline-flex items-center rounded-xl px-3 text-sm font-bold text-[var(--blue-strong)] hover:bg-[var(--blue-soft)]"
            href="/admin/security"
          >
            Keamanan akun
          </Link>
          <SignOutButton />
        </div>
      </div>

      <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-6xl">
        Selamat datang, {admin.name}.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
        Identitas administrator Anda sudah terautentikasi dan terotorisasi. Pengelolaan konten
        sengaja disiapkan untuk Fase 5.
      </p>

      <div className="mt-10 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-8">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Akun
            </dt>
            <dd className="mt-2 break-all text-sm font-medium text-[var(--ink)]">{admin.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Peran
            </dt>
            <dd className="mt-2 text-sm font-medium text-[var(--ink)]">{admin.role}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}

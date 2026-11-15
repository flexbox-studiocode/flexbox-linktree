import { ChangePasswordForm } from "./change-password-form";
import { requireAdmin } from "@/lib/auth/session";

/** Account security screen. Phase 4 scope: password rotation only. */
export default async function AccountSecurityPage() {
  const admin = await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14 sm:px-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Flexbox Studio · Account
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink)]">Keamanan akun</h1>
      <p className="mt-3 text-base leading-7 text-[var(--muted)]">
        Masuk sebagai <span className="font-medium text-[var(--ink)]">{admin.email}</span>. Mengganti
        kata sandi akan mengakhiri seluruh sesi lain pada akun ini.
      </p>

      <section
        aria-labelledby="change-password-title"
        className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-8"
      >
        <h2 className="text-lg font-semibold text-[var(--ink)]" id="change-password-title">
          Ganti kata sandi
        </h2>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
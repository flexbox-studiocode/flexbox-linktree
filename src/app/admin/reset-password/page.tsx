import Link from "next/link";

import { ResetPasswordForm } from "./reset-password-form";

/**
 * The token arrives as a query parameter, which is request-time data, so this
 * page cannot be prerendered into a static shell (`instant = false` documents
 * the intentional block).
 */
export const instant = false;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--page)] px-5 py-12 sm:px-8">
      <section
        aria-labelledby="reset-password-title"
        className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-7 shadow-[0_20px_70px_rgba(31,95,157,0.12)] sm:p-10"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--blue-strong)]">
          Flexbox Studio
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink)]" id="reset-password-title">
          Atur ulang kata sandi
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Pilih kata sandi baru. Tautan hanya dapat dipakai sekali dan kedaluwarsa setelah 60 menit.
        </p>
        <ResetPasswordForm token={token} />
        <p className="mt-6 text-sm text-[var(--muted)]">
          <Link className="font-semibold text-[var(--blue-strong)] hover:underline" href="/admin/login">
            Kembali ke halaman masuk
          </Link>
        </p>
      </section>
    </main>
  );
}

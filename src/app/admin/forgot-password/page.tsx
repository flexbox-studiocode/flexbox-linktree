import Link from "next/link";

import { RequestResetForm } from "./request-reset-form";

/** Public and non-enumerating password recovery screen. */
export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--page)] px-5 py-12 sm:px-8">
      <section
        aria-labelledby="forgot-password-title"
        className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-7 shadow-[0_20px_70px_rgba(31,95,157,0.12)] sm:p-10"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--blue-strong)]">
          Flexbox Studio
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink)]" id="forgot-password-title">
          Lupa kata sandi?
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Masukkan email administrator. Jika akun aktif dengan alamat tersebut ada, tautan pengaturan
          ulang akan dikirim.
        </p>
        <RequestResetForm />
        <p className="mt-6 text-sm text-[var(--muted)]">
          <Link className="font-semibold text-[var(--blue-strong)] hover:underline" href="/admin/login">
            Kembali ke halaman masuk
          </Link>
        </p>
      </section>
    </main>
  );
}

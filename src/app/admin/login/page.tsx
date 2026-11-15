import { Suspense } from "react";

import { AdminLoginForm } from "./login-form";

/**
 * Public sign-in shell.
 *
 * No session is read here: the login page must render for unauthenticated
 * visitors, and any "already signed in" redirect is handled by `src/proxy.ts`.
 * The form reads `?callbackUrl=` on the client, which requires a Suspense
 * boundary because it uses `useSearchParams()`.
 */
export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--page)] px-5 py-12 sm:px-8">
      <section
        aria-labelledby="admin-login-title"
        className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-7 shadow-[0_20px_70px_rgba(31,95,157,0.12)] sm:p-10"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--blue-strong)]">
          Flexbox Studio
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink)]" id="admin-login-title">
          Admin sign in
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Sign in with your approved administrator account to continue.
        </p>
        <Suspense fallback={<p className="mt-8 text-sm text-[var(--muted)]">Loading sign-in form…</p>}>
          <AdminLoginForm />
        </Suspense>
      </section>
    </main>
  );
}

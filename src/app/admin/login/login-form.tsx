"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { GENERIC_LOGIN_ERROR } from "@/features/auth/messages";

/**
 * Credentials login form.
 *
 * The form submits through Auth.js' CSRF-protected `signIn()` flow. The UI never
 * distinguishes unknown email, wrong password, inactive account, or throttling;
 * all failures receive the same generic message. Server-side rate limiting and
 * authorization remain authoritative.
 */
export function AdminLoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("admin-credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      });

      if (!result || result.error) {
        setError(GENERIC_LOGIN_ERROR);
        return;
      }

      // `result.url` comes from Auth.js after its own callbackUrl handling. It
      // is safe to navigate because the value was sanitised before submission.
      window.location.assign(result.url ?? callbackUrl);
    } catch {
      setError(GENERIC_LOGIN_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
      <div>
        <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="admin-email">
          Email
        </label>
        <input
          autoComplete="username"
          className="mt-2 block min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base text-[var(--color-ink)] shadow-sm outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--blue-strong)] focus:ring-4 focus:ring-[var(--blue-soft)]"
          id="admin-email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="admin-password">
          Password
        </label>
        <div className="relative mt-2">
          <input
            autoComplete="current-password"
            className="block min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 pr-24 text-base text-[var(--color-ink)] shadow-sm outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--blue-strong)] focus:ring-4 focus:ring-[var(--blue-soft)]"
            id="admin-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-checked={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-2 right-2 rounded-lg px-3 text-xs font-bold text-[var(--blue-strong)] hover:bg-[var(--blue-soft)] focus-visible:outline-2"
            onClick={() => setShowPassword((current) => !current)}
            role="switch"
            type="button"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error ? (
        <p aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--blue-strong)] px-5 text-sm font-bold text-white transition hover:bg-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

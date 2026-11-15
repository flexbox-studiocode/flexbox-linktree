"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

/**
 * Ends the session through Auth.js.
 *
 * A full page navigation is used after sign-out so the server-rendered admin
 * area cannot keep displaying cached, previously authorized content.
 */
export function SignOutButton() {
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);

    try {
      await signOut({ callbackUrl: "/admin/login", redirect: true });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      className="min-h-11 rounded-[var(--radius)] border border-[var(--line-strong)] px-4 text-sm font-bold text-[var(--ink)] transition hover:bg-[var(--blue-soft)] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isPending}
      onClick={handleSignOut}
      type="button"
    >
      {isPending ? "Keluar..." : "Keluar"}
    </button>
  );
}
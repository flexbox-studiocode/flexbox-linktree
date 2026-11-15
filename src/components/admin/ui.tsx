import Link from "next/link";
import type { ReactNode } from "react";

/** Shared chrome for the CMS screens. Server Components; no client state. */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--blue-strong)] px-5 text-sm font-bold text-white transition hover:bg-[var(--ink)]"
      href={href}
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--blue-soft)]"
      href={href}
    >
      {children}
    </Link>
  );
}

const BADGE_STYLES: Record<string, string> = {
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  DRAFT: "border-amber-200 bg-amber-50 text-amber-800",
  ARCHIVED: "border-slate-300 bg-slate-100 text-slate-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  INACTIVE: "border-slate-300 bg-slate-100 text-slate-700",
  SUSPENDED: "border-amber-200 bg-amber-50 text-amber-800",
  DISABLED: "border-red-200 bg-red-50 text-red-800",
  INVITED: "border-[var(--blue-soft)] bg-[var(--blue-soft)] text-[var(--blue-strong)]",
  OK: "border-emerald-200 bg-emerald-50 text-emerald-800",
  WARNING: "border-amber-200 bg-amber-50 text-amber-800",
  ERROR: "border-red-200 bg-red-50 text-red-800",
};

const BADGE_LABELS: Record<string, string> = {
  PUBLISHED: "Terbit",
  DRAFT: "Konsep",
  ARCHIVED: "Arsip",
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  SUSPENDED: "Ditangguhkan",
  DISABLED: "Dinonaktifkan",
  INVITED: "Diundang",
  OK: "Normal",
  WARNING: "Perhatian",
  ERROR: "Bermasalah",
};

export function StatusBadge({ value }: { value: string }) {
  const style = BADGE_STYLES[value] ?? "border-[var(--line)] bg-[var(--page)] text-[var(--muted)]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {BADGE_LABELS[value] ?? value}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-10 text-center">
      <p className="text-base font-semibold text-[var(--ink)]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--ink)]">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

/** Link-based pagination. No client JavaScript required. */
export function Pagination({
  page,
  pageCount,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) {
    return null;
  }

  const buildHref = (target: number) => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value) {
        query.set(key, value);
      }
    }

    query.set("page", String(target));

    return `${basePath}?${query.toString()}`;
  };

  return (
    <nav aria-label="Navigasi halaman" className="flex flex-wrap items-center gap-2">
      {page > 1 ? (
        <SecondaryLink href={buildHref(page - 1)}>Sebelumnya</SecondaryLink>
      ) : null}
      <span className="px-2 text-sm text-[var(--muted)]">
        Halaman {page} dari {pageCount}
      </span>
      {page < pageCount ? <SecondaryLink href={buildHref(page + 1)}>Berikutnya</SecondaryLink> : null}
    </nav>
  );
}
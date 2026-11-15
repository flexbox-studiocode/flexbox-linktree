"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** CMS navigation. Active-state highlighting needs the current pathname. */

const NAV_ITEMS = [
  { href: "/admin", label: "Dasbor", exact: true },
  { href: "/admin/links", label: "Tautan" },
  { href: "/admin/categories", label: "Kategori" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/settings", label: "Pengaturan situs" },
  { href: "/admin/administrators", label: "Administrator" },
  { href: "/admin/audit-logs", label: "Log audit" },
  { href: "/admin/system", label: "Status sistem" },
  { href: "/admin/security", label: "Keamanan akun" },
] as const;

function isActive(pathname: string, item: (typeof NAV_ITEMS)[number]): boolean {
  if ("exact" in item && item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi CMS" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "min-h-11 shrink-0 rounded-[var(--radius)] bg-[var(--blue-strong)] px-4 text-sm font-semibold text-white"
                : "min-h-11 shrink-0 rounded-[var(--radius)] px-4 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--blue-soft)] hover:text-[var(--ink)]"
            }
            href={item.href}
            key={item.href}
          >
            <span className="flex min-h-11 items-center">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
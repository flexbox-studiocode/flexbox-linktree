import Link from "next/link";

import {
  deleteLinkAction,
  reorderLinkAction,
  toggleLinkActiveAction,
  transitionLinkAction,
} from "@/features/admin/actions/links";
import {
  first,
  pageWindow,
  parseActiveFilter,
  parseLinkStatusFilter,
  parsePageParams,
  parseSearchTerm,
} from "@/features/admin/params";
import { QuickActionForm } from "@/components/admin/quick-action-form";
import {
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  StatusBadge,
} from "@/components/admin/ui";
import { countAdminLinks, findAllCategoryOptions, findAdminLinks } from "@/features/content/repositories/admin-content";
import { requireAdmin } from "@/lib/auth/session";
import { formatJakartaDateTime, toIsoString } from "@/lib/utils/format";
import type { PublicationStatus } from "@/generated/prisma/enums";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Link management list. Reads drafts and archived rows, unlike the public query. */
export default async function AdminLinksPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const { page, pageSize } = parsePageParams({ page: first(params.page), pageSize: first(params.pageSize) });
  const search = parseSearchTerm(params.q);
  const status = parseLinkStatusFilter(params.status);
  const active = parseActiveFilter(params.active);
  const categoryId = first(params.category) ?? "";

  const [rows, total, categories] = await Promise.all([
    findAdminLinks({
      filters: {
        search: search.length > 0 ? search : undefined,
        status,
        active,
        categoryId: categoryId.length > 0 ? categoryId : undefined,
      },
      page,
      pageSize,
    }),
    countAdminLinks({
      search: search.length > 0 ? search : undefined,
      categoryId: categoryId.length > 0 ? categoryId : undefined,
      status,
      active,
    }),
    findAllCategoryOptions(),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = search.length > 0 || status !== "ALL" || active !== "ALL" || categoryId.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<PrimaryLink href="/admin/links/new">Tautan baru</PrimaryLink>}
        description="Kelola seluruh tautan, termasuk konsep dan arsip. Urutan berlaku di dalam masing-masing kategori."
        eyebrow="Flexbox Studio · Konten"
        title="Tautan"
      />

      <Card>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="q">
              Cari
            </label>
            <input
              className="mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
              defaultValue={search}
              id="q"
              name="q"
              placeholder="Judul atau slug"
              type="search"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="status">
              Status
            </label>
            <select
              className="mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
              defaultValue={status}
              id="status"
              name="status"
            >
              <option value="ALL">Semua</option>
              <option value="PUBLISHED">Terbit</option>
              <option value="DRAFT">Konsep</option>
              <option value="ARCHIVED">Arsip</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="active">
              Aktif
            </label>
            <select
              className="mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
              defaultValue={active}
              id="active"
              name="active"
            >
              <option value="ALL">Semua</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="category">
              Kategori
            </label>
            <select
              className="mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
              defaultValue={categoryId}
              id="category"
              name="category"
            >
              <option value="">Semua</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <button
              className="min-h-11 rounded-[var(--radius)] bg-[var(--blue-strong)] px-5 text-sm font-bold text-white transition hover:bg-[var(--ink)]"
              type="submit"
            >
              Terapkan filter
            </button>
            {hasFilters ? (
              <Link
                className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-[var(--blue-strong)] underline"
                href="/admin/links"
              >
                Reset
              </Link>
            ) : null}
            <span className="ml-auto self-center text-xs text-[var(--muted)]">{total} tautan</span>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          action={<PrimaryLink href="/admin/links/new">Buat tautan</PrimaryLink>}
          description={
            hasFilters
              ? "Tidak ada tautan yang cocok dengan filter tersebut. Ubah atau reset filter."
              : "Belum ada tautan. Buat tautan pertama untuk mengisi direktori publik."
          }
          title={hasFilters ? "Tidak ada hasil" : "Belum ada tautan"}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((link) => {
            const linkType =
              link.destinationType === "EXTERNAL"
                ? link.destinationUrl ?? "URL belum diisi"
                : link.destinationType === "INTERNAL"
                  ? link.internalAnchor ?? "Anchor belum diisi"
                  : "Kartu tanpa tautan";

            return (
              <Card key={link.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        className="text-base font-semibold text-[var(--ink)] hover:underline"
                        href={`/admin/links/${link.id}`}
                      >
                        {link.title}
                      </Link>
                      <StatusBadge value={link.status} />
                      {!link.isActive ? <StatusBadge value="INACTIVE" /> : null}
                      {link.isFeatured ? (
                        <span className="rounded-full border border-[var(--blue-soft)] bg-[var(--blue-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--blue-strong)]">
                          Unggulan
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 break-all text-xs text-[var(--muted)]">{linkType}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {link.categoryName}
                      {link.categoryActive ? "" : " (nonaktif)"} · urutan {link.sortOrder} · diubah{" "}
                      <time dateTime={toIsoString(link.updatedAt)}>{formatJakartaDateTime(link.updatedAt)}</time>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(["PUBLISHED", "DRAFT", "ARCHIVED"] as PublicationStatus[])
                      .filter((target) => target !== link.status)
                      .map((target) => (
                        <QuickActionForm
                          action={transitionLinkAction}
                          fields={{ linkId: link.id, to: target }}
                          key={target}
                          label={
                            target === "PUBLISHED"
                              ? link.status === "ARCHIVED"
                                ? "Pulihkan"
                                : "Terbitkan"
                              : target === "ARCHIVED"
                                ? "Arsipkan"
                                : "Jadikan konsep"
                          }
                        />
                      ))}

                    <QuickActionForm
                      action={toggleLinkActiveAction}
                      fields={{ linkId: link.id, isActive: link.isActive ? "" : "on" }}
                      label={link.isActive ? "Nonaktifkan" : "Aktifkan"}
                    />

                    <QuickActionForm
                      action={reorderLinkAction}
                      fields={{ linkId: link.id, direction: "up" }}
                      label="Naik"
                    />
                    <QuickActionForm
                      action={reorderLinkAction}
                      fields={{ linkId: link.id, direction: "down" }}
                      label="Turun"
                    />

                    <QuickActionForm
                      action={deleteLinkAction}
                      confirm={`Hapus tautan "${link.title}"? Tindakan ini tidak dapat dibatalkan.`}
                      fields={{ linkId: link.id }}
                      label="Hapus"
                      pendingLabel="Menghapus..."
                      variant="danger"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination
        basePath="/admin/links"
        page={page}
        pageCount={pageCount}
        params={{
          q: search || undefined,
          status: status === "ALL" ? undefined : status,
          active: active === "ALL" ? undefined : active,
          category: categoryId || undefined,
        }}
      />

      {pageCount > 1 ? (
        <nav aria-label="Lompat ke halaman" className="flex flex-wrap gap-2">
          {pageWindow(page, pageCount).map((target) => (
            <Link
              className={
                target === page
                  ? "inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--radius)] bg-[var(--blue-strong)] px-2 text-sm font-semibold text-white"
                  : "inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--radius)] border border-[var(--line)] px-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--blue-soft)]"
              }
              href={`/admin/links?page=${target}`}
              key={target}
            >
              {target}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
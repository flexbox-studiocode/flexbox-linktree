import Link from "next/link";

import { reorderCategoryAction } from "@/features/admin/actions/categories";
import { CategoryActiveToggle } from "@/components/admin/category-controls";
import { QuickActionForm } from "@/components/admin/quick-action-form";
import {
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  StatusBadge,
} from "@/components/admin/ui";
import { first, parseActiveFilter, parsePageParams, parseSearchTerm } from "@/features/admin/params";
import {
  countAdminCategories,
  findAdminCategories,
} from "@/features/content/repositories/admin-content";
import { requireAdmin } from "@/lib/auth/session";
import { formatJakartaDateTime, toIsoString } from "@/lib/utils/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Category management list with ordering controls. */
export default async function AdminCategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const { page, pageSize } = parsePageParams({ page: first(params.page), pageSize: first(params.pageSize) });
  const search = parseSearchTerm(params.q);
  const active = parseActiveFilter(params.active);

  const [rows, total] = await Promise.all([
    findAdminCategories({
      filters: { search: search.length > 0 ? search : undefined, active },
      page,
      pageSize,
    }),
    countAdminCategories({ search: search.length > 0 ? search : undefined, active }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<PrimaryLink href="/admin/categories/new">Kategori baru</PrimaryLink>}
        description="Urutan kategori menentukan urutan bagian pada halaman publik. Kategori nonaktif menyembunyikan seluruh tautannya."
        eyebrow="Flexbox Studio · Konten"
        title="Kategori"
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="min-w-56 flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="q">
              Cari
            </label>
            <input
              className="mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
              defaultValue={search}
              id="q"
              name="q"
              placeholder="Nama atau slug"
              type="search"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="active">
              Status
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
          <button
            className="min-h-11 rounded-[var(--radius)] bg-[var(--blue-strong)] px-5 text-sm font-bold text-white transition hover:bg-[var(--ink)]"
            type="submit"
          >
            Terapkan
          </button>
          <span className="self-center text-xs text-[var(--muted)]">{total} kategori</span>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          action={<PrimaryLink href="/admin/categories/new">Buat kategori</PrimaryLink>}
          description="Setiap tautan wajib memiliki kategori. Mulai dengan membuat kategori pertama."
          title="Belum ada kategori"
        />
      ) : (
        <div className="space-y-3">
          {rows.map((category) => (
            <Card key={category.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="text-base font-semibold text-[var(--ink)] hover:underline"
                      href={`/admin/categories/${category.id}`}
                    >
                      {category.name}
                    </Link>
                    <StatusBadge value={category.isActive ? "ACTIVE" : "INACTIVE"} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    <span className="font-mono">{category.slug}</span> · {category.linkCount} tautan · urutan{" "}
                    {category.sortOrder} · diubah{" "}
                    <time dateTime={toIsoString(category.updatedAt)}>{formatJakartaDateTime(category.updatedAt)}</time>
                  </p>
                  {category.description ? (
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{category.description}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <CategoryActiveToggle categoryId={category.id} isActive={category.isActive} />
                  <QuickActionForm
                    action={reorderCategoryAction}
                    fields={{ categoryId: category.id, direction: "up" }}
                    label="Naik"
                  />
                  <QuickActionForm
                    action={reorderCategoryAction}
                    fields={{ categoryId: category.id, direction: "down" }}
                    label="Turun"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        basePath="/admin/categories"
        page={page}
        pageCount={pageCount}
        params={{ q: search || undefined, active: active === "ALL" ? undefined : active }}
      />
    </div>
  );
}
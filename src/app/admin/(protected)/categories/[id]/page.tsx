import { notFound } from "next/navigation";

import { CategoryDeleteForm } from "@/components/admin/category-controls";
import { CategoryForm } from "@/components/admin/category-form";
import { Card, PageHeader, SecondaryLink, StatusBadge } from "@/components/admin/ui";
import {
  findAllCategoryOptions,
  findAdminCategoryById,
} from "@/features/content/repositories/admin-content";
import { requireAdmin } from "@/lib/auth/session";
import { formatJakartaDateTime } from "@/lib/utils/format";

/** Edit-category screen, including the guarded delete/reassign flow. */
export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const [category, allCategories] = await Promise.all([findAdminCategoryById(id), findAllCategoryOptions()]);

  if (!category) {
    notFound();
  }

  const alternatives = allCategories
    .filter((candidate) => candidate.id !== category.id)
    .map((candidate) => ({ id: candidate.id, name: candidate.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <StatusBadge value={category.isActive ? "ACTIVE" : "INACTIVE"} />
            <SecondaryLink href="/admin/categories">Kembali</SecondaryLink>
          </>
        }
        description={`Slug ${category.slug} · ${category.linkCount} tautan · diperbarui ${formatJakartaDateTime(category.updatedAt)}`}
        eyebrow="Flexbox Studio · Kategori"
        title={category.name}
      />

      <Card>
        <h2 className="text-base font-semibold text-[var(--ink)]">Isi kategori</h2>
        <div className="mt-4">
          <CategoryForm
            defaultValues={{
              id: category.id,
              name: category.name,
              slug: category.slug,
              description: category.description,
              icon: category.icon,
              sortOrder: category.sortOrder,
              isActive: category.isActive,
            }}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-[var(--ink)]">Hapus kategori</h2>
        <p className="mt-1 mb-4 text-sm leading-6 text-[var(--muted)]">
          Kategori dengan tautan tidak dapat dihapus tanpa pemindahan. Nonaktifkan kategori bila tujuannya hanya
          menyembunyikan dari publik.
        </p>
        <CategoryDeleteForm
          alternatives={alternatives}
          categoryId={category.id}
          categoryName={category.name}
          linkCount={category.linkCount}
        />
      </Card>
    </div>
  );
}
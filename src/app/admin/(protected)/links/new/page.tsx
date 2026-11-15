import { LinkForm } from "@/components/admin/link-form";
import { Card, EmptyState, PageHeader, PrimaryLink, SecondaryLink } from "@/components/admin/ui";
import { findAllCategoryOptions } from "@/features/content/repositories/admin-content";
import { requireAdmin } from "@/lib/auth/session";

/** Create-link screen. A new link is saved as a draft unless publication is chosen. */
export default async function NewLinkPage() {
  await requireAdmin();

  const categories = await findAllCategoryOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<SecondaryLink href="/admin/links">Kembali</SecondaryLink>}
        description="Simpan sebagai konsep terlebih dahulu, lalu terbitkan setelah URL dan kategori diperiksa."
        eyebrow="Flexbox Studio · Tautan"
        title="Tautan baru"
      />

      {categories.length === 0 ? (
        <EmptyState
          action={<PrimaryLink href="/admin/categories/new">Buat kategori</PrimaryLink>}
          description="Setiap tautan wajib memiliki kategori. Buat minimal satu kategori sebelum menambah tautan."
          title="Kategori belum tersedia"
        />
      ) : (
        <Card>
          <LinkForm categories={categories} />
        </Card>
      )}
    </div>
  );
}
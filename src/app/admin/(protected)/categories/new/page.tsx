import { CategoryForm } from "@/components/admin/category-form";
import { Card, PageHeader, SecondaryLink } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";

/** Create-category screen. */
export default async function NewCategoryPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<SecondaryLink href="/admin/categories">Kembali</SecondaryLink>}
        description="Slug harus unik dan dipakai sebagai kunci alami kategori."
        eyebrow="Flexbox Studio · Kategori"
        title="Kategori baru"
      />

      <Card>
        <CategoryForm />
      </Card>
    </div>
  );
}
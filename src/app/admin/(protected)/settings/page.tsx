import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader, SecondaryLink } from "@/components/admin/ui";
import { getSettingsForAdmin } from "@/features/content/services/admin-settings";
import { requireAdmin } from "@/lib/auth/session";

/**
 * Website settings screen.
 *
 * Values are composed from stored settings with approved fallbacks, so a
 * partially seeded database still renders a complete form. Fields the CMS cannot
 * safely manage (raw HTML, scripts, CSS) are not exposed at all.
 */
export default async function AdminSettingsPage() {
  await requireAdmin();

  const values = await getSettingsForAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<SecondaryLink href="/">Lihat situs publik</SecondaryLink>}
        description="Semua teks publik di halaman utama dikelola di sini. Perubahan langsung menggantikan cache konten publik setelah disimpan."
        eyebrow="Flexbox Studio · Situs"
        title="Pengaturan situs"
      />

      <SettingsForm values={values} />
    </div>
  );
}
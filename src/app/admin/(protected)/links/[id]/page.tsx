import { notFound } from "next/navigation";

import { LinkForm } from "@/components/admin/link-form";
import { QuickActionForm } from "@/components/admin/quick-action-form";
import { Card, PageHeader, SecondaryLink, StatusBadge } from "@/components/admin/ui";
import { deleteLinkAction, transitionLinkAction } from "@/features/admin/actions/links";
import { findAllCategoryOptions, findAdminLinkById } from "@/features/content/repositories/admin-content";
import { requireAdmin } from "@/lib/auth/session";
import { formatJakartaDateTime, toIsoString } from "@/lib/utils/format";
import type { PublicationStatus } from "@/generated/prisma/enums";

/** Edit-link screen with the publication controls beside the content form. */
export default async function EditLinkPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const [link, categories] = await Promise.all([findAdminLinkById(id), findAllCategoryOptions()]);

  if (!link) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <StatusBadge value={link.status} />
            <SecondaryLink href="/admin/links">Kembali</SecondaryLink>
          </>
        }
        description={`Slug ${link.slug} · kategori ${link.categoryName} · diperbarui ${formatJakartaDateTime(link.updatedAt)}`}
        eyebrow="Flexbox Studio · Tautan"
        title={link.title}
      />

      <Card>
        <h2 className="text-base font-semibold text-[var(--ink)]">Publikasi</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          Halaman publik hanya menampilkan tautan berstatus terbit yang aktif, berada di kategori aktif, dan memiliki
          tujuan valid.
        </p>

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--muted)]">
          <div>
            <dt className="inline font-semibold">Terbit pertama: </dt>
            <dd className="inline">
              {link.publishedAt ? (
                <time dateTime={toIsoString(link.publishedAt)}>{formatJakartaDateTime(link.publishedAt)}</time>
              ) : (
                "belum pernah"
              )}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Diperbarui: </dt>
            <dd className="inline">
              <time dateTime={toIsoString(link.updatedAt)}>{formatJakartaDateTime(link.updatedAt)}</time>
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
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
                      ? "Pulihkan ke terbit"
                      : "Terbitkan"
                    : target === "ARCHIVED"
                      ? "Arsipkan"
                      : "Jadikan konsep"
                }
                variant={target === "PUBLISHED" ? "primary" : "secondary"}
              />
            ))}

          <QuickActionForm
            action={deleteLinkAction}
            confirm={`Hapus tautan "${link.title}" secara permanen?`}
            fields={{ linkId: link.id }}
            label="Hapus tautan"
            pendingLabel="Menghapus..."
            variant="danger"
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-[var(--ink)]">Isi tautan</h2>
        <div className="mt-4">
          <LinkForm
            categories={categories}
            defaultValues={{
              id: link.id,
              slug: link.slug,
              categoryId: link.categoryId,
              title: link.title,
              description: link.description,
              icon: link.icon,
              tag: link.tag,
              destinationType: link.destinationType,
              destinationUrl: link.destinationUrl,
              internalAnchor: link.internalAnchor,
              status: link.status,
              isActive: link.isActive,
              isFeatured: link.isFeatured,
              sortOrder: link.sortOrder,
            }}
            isEdit
          />
        </div>
      </Card>
    </div>
  );
}
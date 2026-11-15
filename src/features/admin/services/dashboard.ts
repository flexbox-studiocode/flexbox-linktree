import "server-only";

import {
  findRecentlyUpdatedLinks,
  getContentCounts,
  type ContentCounts,
} from "@/features/content/repositories/admin-content";
import { findRecentAuditEvents, type AuditEventRow } from "@/features/admin/repositories/audit";
import { getAdminStatusCounts, type AdminStatusCounts } from "@/features/admin/repositories/admin-users";
import { findMediaPage } from "@/features/media/repository";

/**
 * CMS dashboard summary.
 *
 * Every number is derived from stored data; nothing is estimated. Analytics
 * metrics are deliberately absent because event collection is Phase 6, and a
 * placeholder chart would misrepresent the system state.
 */

export type DashboardSummary = {
  content: ContentCounts;
  media: { total: number; totalBytes: number };
  admins: AdminStatusCounts;
  recentLinks: Awaited<ReturnType<typeof findRecentlyUpdatedLinks>>;
  recentEvents: AuditEventRow[];
  attention: { label: string; detail: string; href: string }[];
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [content, media, admins, recentLinks, recentEvents] = await Promise.all([
    getContentCounts(),
    findMediaPage({ skip: 0, take: 1 }),
    getAdminStatusCounts(),
    findRecentlyUpdatedLinks(5),
    findRecentAuditEvents(6),
  ]);

  const attention: DashboardSummary["attention"] = [];

  if (content.inactiveLinks > 0) {
    attention.push({
      label: `${content.inactiveLinks} tautan nonaktif`,
      detail: "Tautan nonaktif tidak tampil di halaman publik walau berstatus terbit.",
      href: "/admin/links?active=INACTIVE",
    });
  }

  if (content.inactiveCategories > 0) {
    attention.push({
      label: `${content.inactiveCategories} kategori nonaktif`,
      detail: "Semua tautan di bawah kategori nonaktif disembunyikan dari publik.",
      href: "/admin/categories?active=INACTIVE",
    });
  }

  if (admins.invited > 0) {
    attention.push({
      label: `${admins.invited} undangan menunggu`,
      detail: "Undangan perlu diserahkan dan diaktifkan lewat CLI sebelum bisa masuk.",
      href: "/admin/administrators",
    });
  }

  return {
    content,
    media: { total: media.total, totalBytes: media.totalBytes },
    admins,
    recentLinks,
    recentEvents,
    attention,
  };
}
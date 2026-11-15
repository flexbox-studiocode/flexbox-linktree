import Link from "next/link";

import { Card, EmptyState, PageHeader, Pagination } from "@/components/admin/ui";
import {
  countAuditEvents,
  findAuditActors,
  findAuditEventTypes,
  findAuditEvents,
} from "@/features/admin/repositories/audit";
import {
  first,
  parseDateBound,
  parseOptionalId,
  parsePageParams,
} from "@/features/admin/params";
import { requireAdmin } from "@/lib/auth/session";
import { formatJakartaDateTime, toIsoString } from "@/lib/utils/format";
import type { SecurityEventType } from "@/generated/prisma/enums";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PHASE_5_EVENTS = new Set<string>([
  "LINK_CREATED",
  "LINK_UPDATED",
  "LINK_PUBLISHED",
  "LINK_UNPUBLISHED",
  "LINK_ARCHIVED",
  "LINK_RESTORED",
  "LINK_DELETED",
  "LINK_REORDERED",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "CATEGORY_ACTIVATED",
  "CATEGORY_DEACTIVATED",
  "CATEGORY_REORDERED",
  "CATEGORY_DELETED",
  "SETTINGS_UPDATED",
  "MEDIA_UPLOADED",
  "MEDIA_UPDATED",
  "MEDIA_DELETED",
]);

/**
 * Audit history.
 *
 * Reads the shared append-only `security_events` trail. Metadata is rendered from
 * the already-redacted `safeMetadata` column; secrets never reach this table.
 */
export default async function AdminAuditLogsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const { page, pageSize } = parsePageParams({ page: first(params.page), pageSize: first(params.pageSize) });
  const eventType = first(params.event) ?? "ALL";
  const actorId = parseOptionalId(params.actor);
  const from = parseDateBound(params.from, "start");
  const to = parseDateBound(params.to, "end");
  const scope = first(params.scope) === "content" ? "content" : "all";

  const [eventTypes, actors] = await Promise.all([findAuditEventTypes(), findAuditActors()]);

  const validEventType: SecurityEventType | "ALL" = eventTypes.includes(eventType as SecurityEventType)
    ? (eventType as SecurityEventType)
    : "ALL";

  const filters = {
    eventType: validEventType,
    actorId: actorId ?? "ALL",
    from,
    to,
  };

  const [rows, total] = await Promise.all([
    findAuditEvents({ filters, page, pageSize: scope === "content" ? Math.min(pageSize * 4, 100) : pageSize }),
    countAuditEvents(filters),
  ]);

  const visibleRows = scope === "content" ? rows.filter((row) => PHASE_5_EVENTS.has(row.eventType)) : rows;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        description="Catatan tindakan administratif dan peristiwa keamanan. Metadata ditulis melalui allowlist dan tidak memuat kata sandi, token, atau alamat mentah."
        eyebrow="Flexbox Studio · Audit"
        title="Log audit"
      />

      <Card>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="event">
              Jenis peristiwa
            </label>
            <select
              className="mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
              defaultValue={validEventType}
              id="event"
              name="event"
            >
              <option value="ALL">Semua</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="actor">
              Pelaku
            </label>
            <select
              className="mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
              defaultValue={actorId ?? "ALL"}
              id="actor"
              name="actor"
            >
              <option value="ALL">Semua</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="from">
              Dari tanggal
            </label>
            <input
              className="mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
              defaultValue={first(params.from) ?? ""}
              id="from"
              name="from"
              type="date"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" htmlFor="to">
              Sampai tanggal
            </label>
            <input
              className="mt-1 block min-h-11 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
              defaultValue={first(params.to) ?? ""}
              id="to"
              name="to"
              type="date"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-5">
            <button
              className="min-h-11 rounded-[var(--radius)] bg-[var(--blue-strong)] px-5 text-sm font-bold text-white transition hover:bg-[var(--ink)]"
              type="submit"
            >
              Terapkan filter
            </button>
            <Link className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-[var(--blue-strong)] underline" href="/admin/audit-logs">
              Reset
            </Link>
            <Link
              className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-[var(--muted)] underline"
              href="/admin/audit-logs?scope=content"
            >
              Hanya aktivitas konten
            </Link>
            <span className="ml-auto self-center text-xs text-[var(--muted)]">{total} peristiwa</span>
          </div>
        </form>
      </Card>

      {visibleRows.length === 0 ? (
        <EmptyState
          description="Tidak ada peristiwa yang cocok dengan filter tersebut."
          title="Tidak ada catatan"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full border-collapse text-left text-sm">
            <caption className="sr-only">Riwayat peristiwa keamanan dan audit konten</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wider text-[var(--muted)]">
                <th className="px-4 py-3 font-semibold" scope="col">Waktu</th>
                <th className="px-4 py-3 font-semibold" scope="col">Peristiwa</th>
                <th className="px-4 py-3 font-semibold" scope="col">Pelaku</th>
                <th className="px-4 py-3 font-semibold" scope="col">Target</th>
                <th className="px-4 py-3 font-semibold" scope="col">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((event) => (
                <tr className="border-b border-[var(--line)] last:border-0 align-top" key={event.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--muted)]">
                    <time dateTime={toIsoString(event.createdAt)}>{formatJakartaDateTime(event.createdAt)}</time>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--ink)]">{event.eventType}</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {event.actor ? (
                      <>
                        <span className="block font-medium text-[var(--ink)]">{event.actor.fullName}</span>
                        <span className="break-all">{event.actor.email}</span>
                      </>
                    ) : (
                      "Sistem"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {event.targetType ? (
                      <>
                        <span className="block font-medium text-[var(--ink)]">{event.targetType}</span>
                        <span className="break-all font-mono">{event.targetId ?? "—"}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {event.safeMetadata ? (
                      <code className="block max-w-md whitespace-pre-wrap break-all rounded bg-[var(--page)] px-2 py-1 text-xs text-[var(--muted)]">
                        {JSON.stringify(event.safeMetadata, null, 0)}
                      </code>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/admin/audit-logs"
        page={page}
        pageCount={pageCount}
        params={{
          event: validEventType === "ALL" ? undefined : validEventType,
          actor: actorId,
          from: first(params.from),
          to: first(params.to),
          scope: scope === "content" ? "content" : undefined,
        }}
      />
    </div>
  );
}
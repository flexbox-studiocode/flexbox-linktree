import type { ReactNode } from "react";

import type { MetricComparison } from "@/features/analytics/types";

/**
 * Analytics presentation primitives (Server Components, no client state).
 *
 * Every figure is passed in already computed by the reporting service, and every
 * card states its metric definition. A metric that cannot be measured renders an
 * explicit dash instead of a plausible-looking number.
 */

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatMetricValue(value: number | null): string {
  return value === null ? "—" : formatNumber(value);
}

export function ComparisonChip({ comparison }: { comparison: MetricComparison }) {
  if (comparison.isNew) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--blue-soft)] bg-[var(--blue-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--blue-strong)]">
        periode baru
      </span>
    );
  }

  if (comparison.changePercent === null) {
    return <span className="text-xs font-medium text-[var(--muted)]">tidak ada perubahan</span>;
  }

  const isUp = comparison.changePercent > 0;
  const isFlat = comparison.changePercent === 0;

  return (
    <span
      className={
        isFlat
          ? "text-xs font-medium text-[var(--muted)]"
          : isUp
            ? "text-xs font-semibold text-emerald-700"
            : "text-xs font-semibold text-red-700"
      }
    >
      {isFlat ? "sama dengan periode sebelumnya" : `${isUp ? "naik" : "turun"} ${Math.abs(comparison.changePercent)}%`}
      <span className="font-normal text-[var(--muted)]"> vs sebelumnya</span>
    </span>
  );
}

export function MetricCard({
  label,
  value,
  description,
  comparison,
  hint,
}: {
  label: string;
  value: string;
  description: string;
  comparison?: MetricComparison;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold tabular-nums text-[var(--ink)]">{value}</p>
      {comparison ? (
        <p className="mt-1">
          <ComparisonChip comparison={comparison} />
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{description}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function DistributionList({
  title,
  total,
  entries,
  emptyLabel,
}: {
  title: string;
  total: number;
  entries: Array<{ value: string; count: number; sharePercent: number }>;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
        <span className="text-xs tabular-nums text-[var(--muted)]">{formatNumber(total)} peristiwa</span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {entries.map((entry) => (
            <li key={entry.value}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-[var(--ink)]">{entry.value}</span>
                <span className="tabular-nums text-[var(--muted)]">
                  {formatNumber(entry.count)} · {entry.sharePercent}%
                </span>
              </div>
              {/* Decorative bar: the number above is the accessible value. */}
              <div aria-hidden="true" className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--page)]">
                <div className="h-full rounded-full bg-[var(--blue)]" style={{ width: `${Math.min(entry.sharePercent, 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
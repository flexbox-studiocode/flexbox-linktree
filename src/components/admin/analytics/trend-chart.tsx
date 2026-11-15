import type { TrendPoint } from "@/features/analytics/services/query-analytics";

/**
 * Server-rendered trend chart.
 *
 * A hand-rolled SVG keeps the CMS free of a charting dependency, which is the
 * Phase 6 rule for this low-volume report. The chart is decorative in the
 * accessibility tree: the same numbers are provided as a real table for screen
 * readers and keyboard users, and every series starts at zero so the axis is
 * never truncated.
 */

const WIDTH = 720;
const HEIGHT = 240;
const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;

function niceMax(value: number): number {
  if (value <= 4) {
    return Math.max(value, 1);
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return step * magnitude;
}

export function TrendChart({
  points,
  granularity,
  title,
}: {
  points: TrendPoint[];
  granularity: "hour" | "day" | "week" | "month";
  title: string;
}) {
  if (points.length === 0) {
    return (
      <p className="rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-5 py-8 text-center text-sm text-[var(--muted)]">
        Belum ada data pada rentang ini, sehingga grafik tidak digambar.
      </p>
    );
  }

  const series = [
    { key: "pageViews" as const, label: "Kunjungan halaman", color: "var(--blue-strong)" },
    { key: "sessions" as const, label: "Sesi harian", color: "var(--blue)" },
    { key: "linkClicks" as const, label: "Klik tautan", color: "var(--graphite)" },
  ];

  const max = niceMax(Math.max(...points.flatMap((point) => series.map((item) => point[item.key])), 0));
  const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const x = (index: number) => (points.length > 1 ? PAD_LEFT + index * step : PAD_LEFT + innerWidth / 2);
  const y = (value: number) => PAD_TOP + innerHeight - (value / max) * innerHeight;

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(max * ratio));
  const labelIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]));

  const label = (value: string) => {
    if (granularity === "month") {
      const [year, month] = value.split("-");

      return `${month}/${year?.slice(2)}`;
    }

    if (granularity === "week") {
      return `mg ${value.slice(5)}`;
    }

    return value.slice(5);
  };

  return (
    <figure className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--ink)]">{title}</span>
        <span className="text-xs text-[var(--muted)]">
          Sumbu dimulai dari nol. Nilai sesi dijumlahkan per hari pada rentang ini.
        </span>
      </figcaption>

      <ul className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        {series.map((item) => (
          <li className="flex items-center gap-2" key={item.key}>
            <span aria-hidden="true" className="inline-block h-2 w-4 rounded-full" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>

      <svg
        aria-hidden="true"
        className="mt-3 h-auto w-full"
        preserveAspectRatio="none"
        role="presentation"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line
              stroke="var(--line)"
              strokeWidth="1"
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y(value)}
              y2={y(value)}
            />
            <text fill="var(--muted)" fontSize="11" textAnchor="end" x={PAD_LEFT - 8} y={y(value) + 4}>
              {value}
            </text>
          </g>
        ))}

        {series.map((item) => (
          <polyline
            fill="none"
            key={item.key}
            points={points.map((point, index) => `${x(index)},${y(point[item.key])}`).join(" ")}
            stroke={item.color}
            strokeLinejoin="round"
            strokeWidth="2"
          />
        ))}

        {points.map((point, index) => (
          <circle cx={x(index)} cy={y(point.pageViews)} fill="var(--blue-strong)" key={point.bucket} r="2.5" />
        ))}

        {labelIndexes.map((index) => (
          <text
            fill="var(--muted)"
            fontSize="11"
            key={`label-${index}`}
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
            x={x(index)}
            y={HEIGHT - 10}
          >
            {label(points[index].bucket)}
          </text>
        ))}
      </svg>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-[var(--blue-strong)]">
          Tampilkan nilai sebagai tabel
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="px-3 py-2 font-semibold" scope="col">
                  {granularity === "month" ? "Bulan" : granularity === "week" ? "Minggu (mulai)" : "Tanggal"}
                </th>
                {series.map((item) => (
                  <th className="px-3 py-2 text-right font-semibold" key={item.key} scope="col">
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr className="border-b border-[var(--line)] last:border-0" key={point.bucket}>
                  <th className="px-3 py-2 font-medium text-[var(--ink)]" scope="row">
                    {point.bucket}
                  </th>
                  {series.map((item) => (
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--muted)]" key={item.key}>
                      {point[item.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
import { describe, expect, it } from "vitest";

import { csvCell, csvRow, toCsvDocument } from "@/features/analytics/utils/csv";
import { computeComparison, percent } from "@/features/analytics/utils/metrics";
import { buildTrend } from "@/features/analytics/services/query-analytics";

describe("analytics reporting arithmetic", () => {
  it("never divides by zero in period comparisons", () => {
    expect(computeComparison(0, 0)).toEqual({ current: 0, previous: 0, changePercent: null, isNew: false });
    expect(computeComparison(7, 0)).toEqual({ current: 7, previous: 0, changePercent: null, isNew: true });
    expect(computeComparison(0, 7)).toEqual({ current: 0, previous: 7, changePercent: -100, isNew: false });
    expect(computeComparison(11, 10)).toEqual({ current: 11, previous: 10, changePercent: 10, isNew: false });
  });

  it("rounds shares to one decimal and renders zero for an empty denominator", () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(1, 0)).toBe(0);
    expect(percent(1, -1)).toBe(0);
  });

  it("fills quiet daily buckets and merges weekly buckets correctly", () => {
    const series = [
      { day: "2026-11-02", pageViews: 2, linkClicks: 1, sessions: 2 },
      { day: "2026-11-04", pageViews: 3, linkClicks: 4, sessions: 3 },
    ];

    expect(buildTrend({ series, fromDay: "2026-11-02", toDay: "2026-11-04", granularity: "day" })).toEqual([
      { bucket: "2026-11-02", label: "2026-11-02", pageViews: 2, linkClicks: 1, sessions: 2 },
      { bucket: "2026-11-03", label: "2026-11-03", pageViews: 0, linkClicks: 0, sessions: 0 },
      { bucket: "2026-11-04", label: "2026-11-04", pageViews: 3, linkClicks: 4, sessions: 3 },
    ]);

    expect(buildTrend({ series, fromDay: "2026-11-02", toDay: "2026-11-04", granularity: "week" })).toEqual([
      { bucket: "2026-11-02", label: "2026-11-02", pageViews: 5, linkClicks: 5, sessions: 5 },
    ]);
  });
});

describe("analytics CSV serialization", () => {
  it("neutralizes every spreadsheet formula trigger", () => {
    for (const source of ["=2+2", "+2+2", "-2+2", "@SUM(A:A)", "\t=2+2"]) {
      expect(csvCell(source), source).toBe(`'${source}`);
    }

    // A CR-prefixed cell is neutralized *and* quoted, because CR is a row break.
    expect(csvCell("\r=2+2")).toBe(`"'\r=2+2"`);
  });

  it("quotes CSV delimiters and preserves an ordinary numeric value", () => {
    expect(csvCell('a, "quoted" value')).toBe('"a, ""quoted"" value"');
    expect(csvCell(42)).toBe("42");
    expect(csvRow(["rank", "=HYPERLINK(\"https://evil.example\")", 3])).toBe(
      'rank,"\'=HYPERLINK(""https://evil.example"")",3',
    );
  });

  it("uses UTF-8 BOM and CRLF line endings for spreadsheet compatibility", () => {
    expect(toCsvDocument(["a,b", "1,2"])).toBe("\uFEFFa,b\r\n1,2\r\n");
  });
});

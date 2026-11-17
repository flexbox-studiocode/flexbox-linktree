#!/usr/bin/env node
/** Lightweight release smoke: measures public HTML and collector latency. */
const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const requests = Number(process.env.PERF_REQUESTS ?? "50");
const concurrency = Number(process.env.PERF_CONCURRENCY ?? "10");

if (!Number.isInteger(requests) || requests < 1 || !Number.isInteger(concurrency) || concurrency < 1) {
  console.error("perf: PERF_REQUESTS and PERF_CONCURRENCY must be positive integers.");
  process.exit(1);
}

async function measure(url, init) {
  const started = performance.now();
  const response = await fetch(url, init);
  await response.arrayBuffer();
  return { status: response.status, ms: performance.now() - started };
}

async function runBatch(url, init) {
  const results = [];
  let next = 0;

  async function worker() {
    while (next < requests) {
      const index = next++;
      try {
        results[index] = await measure(url, init);
      } catch (error) {
        results[index] = { error: error instanceof Error ? error.message : String(error) };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, worker));
  return results;
}

function summarize(label, results) {
  const valid = results.filter((result) => !result.error);
  const failures = results.length - valid.length;
  const values = valid.map((result) => result.ms).sort((a, b) => a - b);
  const percentile = (p) => values[Math.min(values.length - 1, Math.floor(values.length * p))] ?? 0;
  const statuses = [...new Set(valid.map((result) => result.status))].join(", ");

  console.log(`${label}: requests=${results.length} failures=${failures} statuses=${statuses || "none"} p50=${percentile(0.5).toFixed(1)}ms p95=${percentile(0.95).toFixed(1)}ms max=${(values.at(-1) ?? 0).toFixed(1)}ms`);

  return failures === 0;
}

const page = await runBatch(`${baseUrl}/`, { headers: { accept: "text/html" } });
const collector = await runBatch(`${baseUrl}/api/analytics/collect`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: new URL(baseUrl).origin },
  body: JSON.stringify({ type: "page_view", path: "/" }),
});

const pageOk = summarize("public-page", page) && page.every((result) => result.status === 200);
const collectorOk = summarize("analytics-collector", collector) && collector.every((result) => result.status === 204);

if (!pageOk || !collectorOk) {
  process.exitCode = 1;
}

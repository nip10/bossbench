# Metrics observability parity design

Date: 2026-05-25

## Goal

Move Bossbench metrics from MVP count bars toward Workbench-level operational observability while staying pg-boss-native and SQL-backed.

## Scope

This wave targets issues #23, #24, and #26. Issue #25, Overview health signals, remains a follow-up unless the metrics work exposes a very small safe Overview improvement.

The Metrics page should answer:

- How much work is moving through pg-boss?
- What is the error rate?
- How long are jobs taking after they start?
- How long are jobs waiting before they start?
- Which queues are slowest or failing most often?

## Backend data design

Extend the existing `/api/metrics` response instead of adding new endpoints.

Add typed metrics DTOs:

- `MetricsSummary`
- `MetricPoint`
- `QueueMetricSummary`
- `MetricsResponse`

The response should include:

```ts
{
  summary: {
    totalCreated: number
    totalCompleted: number
    totalFailed: number
    totalRetry: number
    throughputPerHour: number
    errorRate: number
    avgDurationMs: number | null
    avgWaitMs: number | null
  }
  buckets: Array<{
    bucket: string
    created: number
    completed: number
    failed: number
    retry: number
    avgDurationMs: number | null
    avgWaitMs: number | null
  }>
  queues: Array<{
    name: string
    created: number
    completed: number
    failed: number
    retry: number
    errorRate: number
    avgDurationMs: number | null
    avgWaitMs: number | null
    lastActivity: string | null
  }>
}
```

Duration is `completed_on - started_on` where both timestamps exist. Wait time is `started_on - created_on` where both timestamps exist. Use milliseconds for DTO fields so the UI can format consistently.

Keep queries bounded to recent pg-boss rows. The first implementation can use the same 168-hour bucket limit already present, plus queue summaries over that same recent window or a bounded aggregate. Avoid unbounded raw row scans where practical.

## UI design

Replace simple bars with a chart-style dashboard built from CSS/SVG, without adding a chart dependency.

Sections:

1. **Summary cards**
   - Throughput: jobs/hour average.
   - Error rate: failed / completed+failed.
   - Avg duration: processing time.
   - Avg wait: queue delay.

2. **Throughput chart**
   - Recent bucket chart showing completed and failed counts.
   - Keep created/retry visible in summary or legend where space allows.

3. **Duration / wait chart**
   - Recent bucket chart with avg duration and avg wait.

4. **Queue health tables**
   - Slowest queues, sorted by avg duration descending.
   - Failing queues, sorted by error rate / failures descending.

The existing Activity page can remain separate for now.

## Formatting helpers

Add pure UI helpers for:

- duration formatting from milliseconds;
- percentage formatting;
- chart scaling values to 0–100% safely.

These should be tested. Avoid misleading chart widths like the current `value * 10` logic.

## Error handling

- If metrics queries fail, keep the existing error state.
- If duration/wait cannot be computed, show `—`.
- If there are no buckets, show an explanatory empty state.
- Null metric values should not render as `0ms` unless the actual aggregate is zero.

## Testing

Add or update tests for:

- metrics DTO type expectations through repository integration tests;
- formatting helpers;
- chart scaling helper;
- existing metrics endpoint compatibility.

Run full verification before opening the PR.

## Non-goals

- Adding a chart dependency.
- Prometheus/OpenTelemetry export.
- Durable worker registry.
- Per-worker metrics.
- Desktop metrics.
- Full Overview redesign in this wave.

## Success criteria

- `/api/metrics` returns summary, buckets, and queue health data.
- Metrics page has useful summary cards, chart-style panels, and queue health tables.
- Duration/wait calculations are pg-boss-native and documented by tests.
- Existing activity and jobs features remain stable.

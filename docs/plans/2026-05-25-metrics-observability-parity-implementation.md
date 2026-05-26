# Metrics Observability Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand Bossbench metrics into a pg-boss-native observability dashboard with summary, bucket, and queue-health data.

**Architecture:** Extend the existing `/api/metrics` repository method and DTOs, then update the client API/hooks and Metrics page to consume the richer response. Use pure formatting/scaling helpers and CSS/SVG-style UI components instead of adding a chart library.

**Tech Stack:** Bun, TypeScript, React 19, TanStack Query, pg, pg-boss, Vitest, SQL against pg-boss tables.

---

## Task 1: Add metrics DTO types

**Files:**
- Modify: `packages/core/src/core/types.ts`

**Steps:**
1. Add interfaces: `MetricsSummary`, `QueueMetricSummary`, `MetricsResponse`.
2. Extend `MetricPoint` with `avgDurationMs: number | null` and `avgWaitMs: number | null`.
3. Update references to use `MetricsResponse` where practical.
4. Run `bun run --filter=@bossbench/core typecheck`.

## Task 2: Repository metrics aggregation

**Files:**
- Modify: `packages/core/src/core/repository.ts`
- Modify: `packages/core/src/core/repository.integration.test.ts`

**TDD steps:**
1. Update integration test to assert `getMetrics()` returns `summary`, `buckets`, and `queues`.
2. Assert `summary.totalCreated`, `summary.totalCompleted`, `summary.totalFailed`, `summary.errorRate`, and queue rows exist for seeded queues.
3. Run integration test and confirm it fails against the old shape.
4. Implement SQL aggregation:
   - bucket counts and avg duration/wait in milliseconds;
   - summary totals and averages;
   - queue health rows.
5. Keep queries bounded and parameterized where values are used.
6. Run integration test.

Command:
```bash
BOSSBENCH_DATABASE_URL="postgres://postgres:postgres@localhost:54329/bossbench" bun run --filter=@bossbench/core test:integration
```

If local Postgres is unavailable, write tests and run all non-integration checks; document the blocker.

## Task 3: Client API and hook typing

**Files:**
- Modify: `packages/core/src/ui/lib/api.ts`
- Modify: `packages/core/src/ui/lib/hooks.ts`

**Steps:**
1. Import/use `MetricsResponse` in API typing.
2. Update `api.metrics()` return type to `MetricsResponse`.
3. Ensure `useMetrics()` remains unchanged behaviorally but benefits from typing.
4. Run `bun run --filter=@bossbench/core typecheck`.

## Task 4: Metrics formatting/scaling helpers

**Files:**
- Create: `packages/core/src/ui/lib/metrics.ts`
- Create: `packages/core/src/ui/lib/metrics.test.ts`

**TDD steps:**
1. Write tests for:
   - `formatDurationMs(null) -> "—"`;
   - sub-second, seconds, minutes formatting;
   - `formatPercent(0.1234) -> "12.3%"`;
   - `scaleValue(value, max)` clamps safely and handles max 0.
2. Run test and confirm missing module failure.
3. Implement helpers.
4. Run focused test.

Command:
```bash
bun run --filter=@bossbench/core test -- src/ui/lib/metrics.test.ts
```

## Task 5: Metrics page UI

**Files:**
- Modify: `packages/core/src/ui/pages.tsx`
- Modify: `packages/core/src/ui/styles/globals.css`

**Steps:**
1. Replace `MetricsPage` totals logic with `MetricsResponse` consumption.
2. Add summary cards:
   - Throughput;
   - Error Rate;
   - Avg Duration;
   - Avg Wait.
3. Add chart-style panels:
   - throughput buckets;
   - duration/wait buckets.
4. Add queue health tables:
   - slowest queues;
   - failing queues.
5. Ensure no-data states are clear.
6. Add responsive CSS for chart panels and tables.
7. Run typecheck/lint.

## Task 6: API/handler compatibility tests

**Files:**
- Modify: `packages/core/src/api/fetch-handler.test.ts` or create metrics handler test if needed.

**Steps:**
1. Add a focused API/fetch-handler test proving `/metrics` returns the repository metrics payload unchanged.
2. Run focused API tests.

Command:
```bash
bun run --filter=@bossbench/core test -- src/api/fetch-handler.test.ts
```

## Task 7: Final verification

Run:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
BOSSBENCH_DATABASE_URL="postgres://postgres:postgres@localhost:54329/bossbench" bun run test:integration
bun run smoke
```

Expected:
- lint exits 0, allowing existing generated-file warnings;
- typecheck exits 0;
- tests exit 0;
- build exits 0 when local example DB requirements are satisfied;
- integration exits 0 when Postgres is available;
- smoke exits 0.

## PR notes

PR should mention:

- closes #23, #24, #26;
- contributes to #11;
- #25 remains follow-up unless included.

## CI note

This PR is expected to use the base CI workflow with full checkout history for commitlint.

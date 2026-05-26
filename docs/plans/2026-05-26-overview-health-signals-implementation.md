# Overview Health Signals Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add metrics-driven health cards and queue health summaries to the Overview page.

**Architecture:** Reuse `useOverview()` and `useMetrics()` in `OverviewPage`. Use existing `SummaryCard`, `Table`, `EmptyState`, and metrics formatting helpers. No backend/API changes.

**Tech Stack:** React 19, TanStack Query, existing Bossbench UI components, TypeScript, Vitest.

---

## Task 1: Update OverviewPage data flow

**Files:**
- Modify: `packages/core/src/ui/pages.tsx`

**Steps:**
1. In `OverviewPage`, call `useMetrics()` in addition to `useOverview()`.
2. Preserve current Overview loading/error behavior for `useOverview()`.
3. Do not let metrics errors replace the whole Overview when overview data exists.
4. Import/use `formatDurationMs` and `formatPercent` from `./lib/metrics`.

## Task 2: Add health cards

**Files:**
- Modify: `packages/core/src/ui/pages.tsx`

**Steps:**
1. Add a new `Section` titled `Health signals`.
2. Render four cards:
   - Throughput;
   - Error Rate;
   - Avg Wait;
   - Avg Duration.
3. Use metrics summary when available.
4. Show `—` for unavailable values.
5. Show compact loading/warning text when metrics are loading or failed.

## Task 3: Add queue health summaries

**Files:**
- Modify: `packages/core/src/ui/pages.tsx`
- Modify: `packages/core/src/ui/styles/globals.css` only if layout needs small styles.

**Steps:**
1. Derive `slowestQueues` from `metrics.queues`, sorted by `avgDurationMs` desc nulls last.
2. Derive `failingQueues`, sorted by `failed` desc then `errorRate` desc.
3. Render two compact tables inside Overview:
   - Slowest queues: Queue, Avg Duration, Avg Wait, Completed, Failed.
   - Failing queues: Queue, Error Rate, Failed, Completed, Retry.
4. Limit each table to 5 rows.
5. Show muted empty copy if no queue metrics exist.

## Task 4: Verification

Run:

```bash
bun run --filter=@bossbench/core lint
bun run --filter=@bossbench/core typecheck
bun run --filter=@bossbench/core test -- src/ui/lib/metrics.test.ts
bun run lint
bun run typecheck
bun run test
```

Expected: all pass, allowing existing generated-file warnings.

## Task 5: Merge and issue update

1. Commit branch.
2. Merge to `main` locally.
3. Push `main`.
4. Comment on and close #25.
5. Comment on #11 that Overview health signals shipped.

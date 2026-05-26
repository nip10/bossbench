# Schedule Future Jobs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a pg-boss-native future-jobs API foundation that keeps schedule metadata separate from concrete future job rows.

**Architecture:** Extend the existing repository job-list query with an internal `future` filter and expose it through `listFutureJobs()` plus `GET /future-jobs`. Keep schedules unchanged; this is read-only API groundwork for a later UI route.

**Tech Stack:** TypeScript, pg-boss/Postgres SQL, Vitest, Bun/Turbo monorepo.

---

### Task 1: Add failing repository tests

**Files:**
- Create: `packages/core/src/core/repository.test.ts`

**Step 1: Write tests**

Test `BossbenchRepository.listFutureJobs()` with a fake pg client. Assert that SQL includes `start_after > now()`, limits states to created/retry, orders by `start_after asc`, and maps `startAfter` onto returned job summaries.

**Step 2: Verify RED**

Run: `bun run --filter=@bossbench/core test -- src/core/repository.test.ts`

Expected: FAIL because `listFutureJobs` and `startAfter` mapping do not exist yet.

### Task 2: Add failing API route test

**Files:**
- Modify: `packages/core/src/api/handlers.test.ts`

**Step 1: Write test**

Add a test that finds `GET /future-jobs`, calls it with normal query filters, and expects `repository.listFutureJobs` to receive parsed filters.

**Step 2: Verify RED**

Run: `bun run --filter=@bossbench/core test -- src/api/handlers.test.ts`

Expected: FAIL because `/future-jobs` is not registered.

### Task 3: Implement repository/API support

**Files:**
- Modify: `packages/core/src/core/types.ts`
- Modify: `packages/core/src/core/repository.ts`
- Modify: `packages/core/src/api/handlers.ts`

**Step 1: Implement minimal code**

- Add `future?: boolean` to `QueryFilters`.
- Add optional/nullable `startAfter` to `JobSummary`.
- Select `start_after` from job rows.
- Map `start_after` to `startAfter`.
- Allow `start_after` in sorting.
- Add `listFutureJobs(filters)` that calls `listJobs({ ...filters, future: true, sort: filters.sort ?? "start_after:asc" })`.
- When `future` is true, add SQL predicates for `state in ('created','retry')` unless a created/retry state filter is provided, and always add `start_after > now()`.
- Register `GET /future-jobs` to call `repository.listFutureJobs(parseFilters(query))`.

### Task 4: Add client foundation

**Files:**
- Modify: `packages/core/src/ui/lib/api.test.ts`
- Modify: `packages/core/src/ui/lib/api.ts`
- Modify: `packages/core/src/ui/lib/hooks.ts`

**Step 1: Write failing API client test**

Add a test proving `api.futureJobs({ queue, limit, sort })` fetches `/future-jobs` with serialized job query parameters.

**Step 2: Verify RED**

Run: `bun run --filter=@bossbench/core test -- src/ui/lib/api.test.ts`

Expected: FAIL because `api.futureJobs` does not exist yet.

**Step 3: Implement client methods**

Add `api.futureJobs()` and `useFutureJobs()` using the existing job query serializer and React Query key normalization.

**Step 4: Verify GREEN**

Run: `bun run --filter=@bossbench/core test -- src/ui/lib/api.test.ts`

Expected: PASS.

**Step 5: Verify backend GREEN**

Run:

- `bun run --filter=@bossbench/core test -- src/core/repository.test.ts`
- `bun run --filter=@bossbench/core test -- src/api/handlers.test.ts`

Expected: PASS.

### Task 5: Final verification

**Files:**
- Verify all files touched in tasks 1-3.

**Step 1: Run package tests**

Run: `bun run --filter=@bossbench/core test`

Expected: PASS.

**Step 2: Run lint**

Run: `bun run lint`

Expected: PASS, except known generated Next env warnings may appear.

**Step 3: Inspect diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intended files changed.

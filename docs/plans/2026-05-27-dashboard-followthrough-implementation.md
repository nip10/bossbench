# Dashboard Follow-Through Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dashboard UI for Future Jobs and schedule Run Now.

**Architecture:** Reuse existing dashboard table/filter patterns and the already-merged API client methods `useFutureJobs()` and `api.runScheduleNow()`.

**Tech Stack:** React, TanStack Router, TanStack Query, TypeScript, Vitest, Bun/Turbo monorepo.

---

### Task 1: Add Future Jobs helpers and tests

- Create `packages/core/src/ui/lib/future-jobs.ts`.
- Create `packages/core/src/ui/lib/future-jobs.test.ts`.
- Verify RED, then GREEN.

### Task 2: Add Future Jobs page and navigation

- Modify `packages/core/src/ui/pages.tsx`.
- Modify `packages/core/src/ui/router.tsx`.
- Modify `packages/core/src/ui/components/layout/sidebar.tsx`.
- Modify `packages/core/src/ui/components/layout/command-palette.tsx`.

### Task 3: Add Schedule Run Now row action

- Modify `SchedulesPage` in `packages/core/src/ui/pages.tsx`.
- Disable schedule actions during in-flight mutations.
- Style Unschedule as destructive.

### Task 4: Verify

- `bun run --filter=@bossbench/core test`
- `bun run --filter=@bossbench/core typecheck`
- `bun run lint`
- `git diff --check`

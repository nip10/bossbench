# Schedule Run Now Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a guarded API/client foundation for running a pg-boss schedule once immediately without changing its recurrence.

**Architecture:** Reuse schedule metadata from the repository and enqueue through `PgBossActionService`, which already enforces readonly and live-`PgBoss` guards. Expose the action through `POST /schedules/:name/run-now` and `api.runScheduleNow()`.

**Tech Stack:** TypeScript, pg-boss, Vitest, Bun/Turbo monorepo.

---

### Task 1: Action service RED/GREEN

**Files:**
- Modify: `packages/core/src/core/actions.test.ts`
- Modify: `packages/core/src/core/actions.ts`

**Steps:**
1. Add a failing test proving `runScheduleNow("email", data, opts)` calls `boss.send("email", data, opts)` and returns `{ id }`.
2. Run `bun run --filter=@bossbench/core test -- src/core/actions.test.ts` and confirm failure because the method is missing.
3. Implement the minimal action method.
4. Rerun the focused test and confirm pass.

### Task 2: API route RED/GREEN

**Files:**
- Modify: `packages/core/src/api/handlers.test.ts`
- Modify: `packages/core/src/api/handlers.ts`

**Steps:**
1. Add a failing test for `POST /schedules/:name/run-now` that stubs `repository.getSchedules()` with the requested schedule and expects `actions.runScheduleNow(name, data, opts)`.
2. Add a missing-schedule test expecting `SCHEDULE_NOT_FOUND`.
3. Run `bun run --filter=@bossbench/core test -- src/api/handlers.test.ts` and confirm failure because the route is missing.
4. Implement the route.
5. Rerun the focused test and confirm pass.

### Task 3: UI API client RED/GREEN

**Files:**
- Modify: `packages/core/src/ui/lib/api.test.ts`
- Modify: `packages/core/src/ui/lib/api.ts`

**Steps:**
1. Add a failing test proving `api.runScheduleNow("email")` POSTs `/schedules/email/run-now`.
2. Run `bun run --filter=@bossbench/core test -- src/ui/lib/api.test.ts` and confirm failure because the client method is missing.
3. Implement the client method.
4. Rerun the focused test and confirm pass.

### Task 4: Final verification

Run:

- `bun run --filter=@bossbench/core test`
- `bun run --filter=@bossbench/core typecheck`
- `bun run lint`
- `git diff --check && git status --short`

Expected: all pass; lint may keep existing generated Next env warnings.

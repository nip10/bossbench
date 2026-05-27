# Queue Clean and Manual Enqueue Safety Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add safe capability-gated manual enqueue and enqueue-copy APIs/UI, while keeping queue clean as an implementation-ready design until direct SQL policy and pg-boss table resolution are approved.

**Architecture:** Extend `BossbenchOptions` with explicit high-risk capability flags, route all writes through `PgBossActionService`, and keep server-side guards authoritative. Implement manual enqueue and clone through `PgBoss.send()` only; do not directly insert jobs or implement queue clean deletion in this wave. Update UI and docs to surface capabilities safely.

**Tech Stack:** Bun workspaces, TypeScript, React, Hono, pg-boss, pg, Vitest, Turbo.

---

## Task 1: Capability flags and config exposure

**Files:**
- Modify: `packages/core/src/core/types.ts`
- Modify: `packages/core/src/core/options.ts`
- Modify: `packages/core/src/core/core.ts`
- Modify: `packages/core/src/core/options.test.ts`
- Modify: `packages/core/src/core/core.test.ts`

**Steps:** Write failing tests for `allowManualEnqueue` and `allowQueueClean` defaults/config exposure, run `bun test packages/core/src/core/options.test.ts packages/core/src/core/core.test.ts`, implement fields in options/core config, rerun tests.

## Task 2: Manual enqueue action service

**Files:**
- Modify: `packages/core/src/core/actions.ts`
- Modify: `packages/core/src/core/actions.test.ts`
- Modify: `packages/core/src/core/core.ts`

**Steps:** Write failing tests for disabled/manual enqueue/read-only/send behavior, run `bun test packages/core/src/core/actions.test.ts`, add action capabilities and `enqueueJob()`, wire core, rerun actions/core tests.

## Task 3: API validation and routes

**Files:**
- Modify: `packages/core/src/api/handlers.ts`
- Modify: `packages/core/src/api/handlers.test.ts`
- Modify: `packages/core/src/core/types.ts`

**Steps:** Add failing tests for `POST /queues/:name/enqueue`, validation failures, `POST /jobs/:id/clone`, and missing job behavior. Implement request/result types, payload/option validation, routes, and `MANUAL_ENQUEUE_DISABLED` status/message. Run `bun test packages/core/src/api/handlers.test.ts`.

## Task 4: Client API methods

**Files:**
- Modify: `packages/core/src/ui/lib/api.ts`
- Modify: `packages/core/src/ui/lib/api.test.ts`

**Steps:** Write failing tests for `api.enqueueJob()` and `api.cloneJob()`, implement client methods, run `bun test packages/core/src/ui/lib/api.test.ts`.

## Task 5: Minimal UI for clone and manual enqueue

**Files:**
- Modify: `packages/core/src/ui/pages.tsx`
- Create if useful: `packages/core/src/ui/lib/enqueue.ts`
- Test if helper created: `packages/core/src/ui/lib/enqueue.test.ts`

**Steps:** Add helper tests if extracting JSON parsing. Add Job detail **Enqueue copy** button gated by `actionsEnabled && config?.allowManualEnqueue`. Add minimal Queue page enqueue panel if it stays small; otherwise keep clone-only. Run helper/API tests and `bun run --filter=@bossbench/core typecheck`.

## Task 6: Queue clean remains design-only in code/docs

**Files:**
- Modify: `docs/workbench-parity-tracker.md`
- Modify: `README.md`

**Steps:** Update tracker to say queue clean has safety design and is blocked on direct SQL policy/table resolution. Document `allowManualEnqueue` and `allowQueueClean` options as default false. Run `git diff --check`.

## Task 7: Verification

Run:

```bash
bun run lint
bun run typecheck
bun run test
bun run smoke
git diff --check
```

Expected: all pass; smoke may skip DB-backed demo if `BOSSBENCH_SMOKE_DATABASE_URL` is unset.

## Task 8: Review and PR

Use @oracle to review manual enqueue capability flag safety, API validation, clone semantics, no queue-clean implementation, and no MCP mutation tools. Fix Critical/Important findings. Commit, push, and create PR referencing #59 and #60.

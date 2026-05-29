# Queue Clean Preview and Docs Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add safe queue-clean preview support and improve package/docs discoverability without destructive queue-clean deletion.

**Architecture:** Add queue-clean preview as a read-only SQL query exposed through the existing mutation route layer but gated by action-service availability and `allowQueueClean`. Keep deletion out of scope. In parallel, update docs/metadata and marketing copy-command overflow polish.

**Tech Stack:** Bun workspaces, TypeScript, React, Hono, pg-boss, pg, Vitest, Turbo.

---

## Task 1: Queue clean preview backend

**Files:**
- Modify: `packages/core/src/core/types.ts`
- Modify: `packages/core/src/core/actions.ts`
- Modify: `packages/core/src/core/actions.test.ts`
- Modify: `packages/core/src/core/repository.ts`
- Modify: `packages/core/src/core/repository.test.ts`
- Modify: `packages/core/src/api/handlers.ts`
- Modify: `packages/core/src/api/handlers.test.ts`

**Steps:**
1. Add tests first for `ensureQueueCleanAvailable()` blocked by readonly, missing boss, and disabled `allowQueueClean`.
2. Add repository tests for preview query filtering by queue, state, completed_on cutoff, limit, and sample IDs.
3. Add route tests for `POST /queues/:name/clean-preview` validation and successful preview.
4. Implement types: `QueueCleanPreviewRequest`, `QueueCleanPreviewResult`.
5. Implement action guard method in `PgBossActionService`.
6. Implement repository `previewQueueClean()` using SELECT-only SQL.
7. Implement route validation and response mapping.
8. Run targeted tests.

## Task 2: Queue clean preview client/UI

**Files:**
- Modify: `packages/core/src/ui/lib/api.ts`
- Modify: `packages/core/src/ui/lib/api.test.ts`
- Create if helpful: `packages/core/src/ui/lib/queue-clean.ts`
- Create if helpful: `packages/core/src/ui/lib/queue-clean.test.ts`
- Modify: `packages/core/src/ui/pages.tsx`

**Steps:**
1. Add client API tests for `previewQueueClean(queue, request)`.
2. Add helper tests for age/limit parsing if extracting helpers.
3. Add Queue page preview panel gated by `actionsEnabled && config?.allowQueueClean`.
4. Render preview result with matched count, cutoff, sample IDs, and has-more copy.
5. Run targeted UI/helper tests and core typecheck.

## Task 3: Package/docs discoverability polish

**Files:**
- Modify: root `package.json`
- Modify: `packages/*/package.json` as appropriate
- Modify: `packages/core/README.md`
- Modify: `README.md`
- Modify: `apps/web/src/components/copy-command.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `docs/workbench-parity-tracker.md`

**Steps:**
1. Add package metadata/keywords/homepage consistency for pg-boss dashboard discoverability.
2. Expand `packages/core/README.md` with adapter matrix, CLI setup, core API example, and options table.
3. Update root README if adapter/package lists are stale.
4. Add copy-command overflow/scroll styling for long commands.
5. Update parity tracker row for #68 to implemented if docs polish is complete.

## Task 4: Verification and review

Run:

```bash
bun run lint
bun run typecheck
bun run test
bun run smoke
git diff --check
```

Request @oracle review focused on:

- no destructive queue clean implementation;
- queue clean preview safety gates;
- SQL read query correctness;
- package/docs wording accuracy.

## Task 5: PR

Commit, push, and create a PR referencing #59 and #68.

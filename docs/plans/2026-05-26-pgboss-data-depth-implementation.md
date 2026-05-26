# pg-boss Data Depth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve schedules, warnings, and dead-letter pg-boss-native UX.

**Architecture:** Reuse existing API endpoints and DTOs. Add a pure UI helper for parsing optional schedule JSON data, then update Schedules/Warnings/Dead Letter pages.

**Tech Stack:** React 19, TypeScript, existing Bossbench UI, Vitest.

---

## Task 1: Schedule data helper

Files:
- Create `packages/core/src/ui/lib/schedules.ts`
- Create `packages/core/src/ui/lib/schedules.test.ts`

Behavior:
- `parseScheduleDataInput("")` returns `undefined`.
- whitespace returns `undefined`.
- valid JSON returns parsed value.
- invalid JSON throws `Invalid schedule JSON data`.

## Task 2: Schedules page JSON data input

Files:
- Modify `packages/core/src/ui/pages.tsx`

Behavior:
- Add optional JSON data textarea/input to create schedule form.
- Parse before calling `api.createSchedule`.
- Show inline action state on invalid JSON.
- Pass parsed `data` when present.

## Task 3: Warnings and dead-letter copy/depth

Files:
- Modify `packages/core/src/ui/pages.tsx`

Behavior:
- Warnings empty state mentions pg-boss warning persistence/configuration.
- Dead-letter page shows summary cards for failed count and selected context before table.
- Preserve links to job detail.

## Task 4: Verification

Run:

```bash
bun run --filter=@bossbench/core test -- src/ui/lib/schedules.test.ts
bun run --filter=@bossbench/core lint
bun run --filter=@bossbench/core typecheck
bun run lint
bun run typecheck
bun run test
```

Expected: pass, allowing existing generated-file warnings.

# Job Browsing and Actions Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring Bossbench job browsing and job actions to Workbench-level operational usefulness while preserving pg-boss-native semantics.

**Architecture:** Keep reads SQL-backed through `BossbenchRepository` and mutations pg-boss-backed through `PgBossActionService`. Extend existing `QueryFilters`, route handlers, client API, and Jobs UI instead of creating a parallel job browser. Bulk actions should return per-job results and degrade clearly in read-only or browse-only mode.

**Tech Stack:** Bun, TypeScript, React 19, TanStack Router, TanStack Query, pg, pg-boss, Hono route definitions, Vitest, existing Bossbench UI primitives.

---

## Important execution notes

- Use TDD for API/filter/action behavior.
- Use sub-agents for bounded implementation tasks.
- Do not add BullMQ-only concepts such as flows, promote, or queue pause/resume.
- Do not edit arbitrary job payloads or states.
- Do not commit unless the user explicitly asks; treat commit steps below as checkpoint boundaries for normal development workflows.

## Task 1: Client query serialization for tag filters and pagination

**Files:**
- Modify: `packages/core/src/ui/lib/api.ts`
- Test: create or modify `packages/core/src/ui/lib/api.test.ts`

**Step 1: Write failing tests**

Create tests for query serialization behavior:

```ts
import { describe, expect, it } from "vitest";
import { buildJobsQuery } from "./api";

describe("buildJobsQuery", () => {
  it("serializes core job filters", () => {
    expect(
      buildJobsQuery({
        queue: "email",
        state: "failed",
        q: "daily",
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-02T00:00:00.000Z",
        sort: "created_on:desc",
        limit: 50,
        offset: 100,
      }),
    ).toBe(
      "?limit=50&offset=100&queue=email&state=failed&q=daily&from=2026-05-01T00%3A00%3A00.000Z&to=2026-05-02T00%3A00%3A00.000Z&sort=created_on%3Adesc",
    );
  });

  it("serializes configured tag filters as repeated tag params", () => {
    expect(
      buildJobsQuery({
        tags: {
          teamId: ["alpha", "beta"],
          region: ["eu"],
        },
      }),
    ).toBe("?tag.teamId=alpha&tag.teamId=beta&tag.region=eu");
  });
});
```

**Step 2: Run tests to verify failure**

Run: `bun run --filter=@bossbench/core test packages/core/src/ui/lib/api.test.ts`

Expected: FAIL because `buildJobsQuery` is not exported and tags are not serialized.

**Step 3: Implement minimal serialization**

- Export a pure `buildJobsQuery(filters?: QueryFilters): string` helper from `packages/core/src/ui/lib/api.ts`.
- Replace the private `query()` helper with `buildJobsQuery()`.
- Serialize `filters.tags` as repeated `tag.${field}` query params.
- Preserve existing ordering for deterministic tests.

**Step 4: Run tests**

Run: `bun run --filter=@bossbench/core test packages/core/src/ui/lib/api.test.ts`

Expected: PASS.

**Step 5: Checkpoint**

Review diff for `api.ts` and `api.test.ts` only.

## Task 2: API parse tests for advanced job filters

**Files:**
- Modify: `packages/core/src/api/handlers.ts`
- Test: create or modify `packages/core/src/api/handlers.test.ts`

**Step 1: Write failing tests**

Add tests around `buildRouteTable()` using a fake core/repository:

```ts
import { describe, expect, it, vi } from "vitest";
import { buildRouteTable } from "./handlers";

describe("job filter route parsing", () => {
  it("passes queue, state, search, dates, sort, pagination, and repeated tags to repository", async () => {
    const listJobs = vi.fn().mockResolvedValue({ items: [], page: 3, pageSize: 50, total: 125 });
    const routes = buildRouteTable({
      repository: { listJobs },
      actions: {},
      getConfig: () => ({}),
    } as never);
    const route = routes.find((r) => r.method === "get" && r.path === "/jobs");

    await route?.handler({
      params: {},
      query: {
        limit: "50",
        offset: "100",
        queue: "email",
        state: "failed",
        q: "daily",
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-02T00:00:00.000Z",
        sort: "created_on:desc",
        "tag.teamId": ["alpha", "beta"],
      },
    });

    expect(listJobs).toHaveBeenCalledWith({
      limit: 50,
      offset: 100,
      queue: "email",
      state: "failed",
      q: "daily",
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-05-02T00:00:00.000Z",
      sort: "created_on:desc",
      tags: { teamId: ["alpha", "beta"] },
    });
  });
});
```

**Step 2: Run tests**

Run: `bun run --filter=@bossbench/core test packages/core/src/api/handlers.test.ts`

Expected: PASS if current parsing already handles this; otherwise FAIL and implement the missing behavior.

**Step 3: Implement only if needed**

- Keep `parseFilters()` private unless test structure requires exporting a pure helper.
- Do not change route response shapes.

**Step 4: Run tests**

Run: `bun run --filter=@bossbench/core test packages/core/src/api/handlers.test.ts`

Expected: PASS.

## Task 3: Bulk action service and route handlers

**Files:**
- Modify: `packages/core/src/core/types.ts`
- Modify: `packages/core/src/api/handlers.ts`
- Test: `packages/core/src/api/handlers.test.ts`

**Step 1: Add type definitions in tests first**

Write tests for three new endpoints:

- `POST /jobs/bulk/retry`
- `POST /jobs/bulk/cancel`
- `POST /jobs/bulk/delete`

Expected request body:

```ts
{ ids: ["job-1", "job-2"] }
```

Expected success body:

```ts
{
  ok: true,
  result: {
    succeeded: [{ id: "job-1" }],
    failed: [{ id: "job-2", code: "JOB_NOT_FOUND", message: "Job not found" }]
  }
}
```

Test cases:

- empty/missing ids returns `INVALID_FILTER`;
- missing job appears in `failed`;
- action errors appear in `failed`;
- route still returns 200 when at least one result was processed;
- readonly/missing boss from action service appears as per-job failure unless every item fails before action execution.

**Step 2: Run tests to verify failure**

Run: `bun run --filter=@bossbench/core test packages/core/src/api/handlers.test.ts`

Expected: FAIL because routes do not exist.

**Step 3: Implement types**

Add to `packages/core/src/core/types.ts`:

```ts
export interface BulkJobActionResult {
  succeeded: Array<{ id: string }>;
  failed: Array<{ id: string; code: string; message: string }>;
}
```

**Step 4: Implement route handlers**

In `packages/core/src/api/handlers.ts`:

- add routes before `/jobs/:id` to avoid path ambiguity in fetch-handler iteration;
- parse body with `ids?: unknown`;
- validate array of non-empty strings;
- for each id, call `repository.getJob(id)`;
- if missing, push `JOB_NOT_FOUND` failure;
- otherwise call the relevant `actions` method with `job.name` and `job.id`;
- collect per-job success/failure.

**Step 5: Run tests**

Run: `bun run --filter=@bossbench/core test packages/core/src/api/handlers.test.ts`

Expected: PASS.

## Task 4: Client API for bulk actions

**Files:**
- Modify: `packages/core/src/ui/lib/api.ts`
- Test: `packages/core/src/ui/lib/api.test.ts`

**Step 1: Write failing tests**

Test that `api.bulkRetryJobs`, `api.bulkCancelJobs`, and `api.bulkDeleteJobs` call the correct endpoints with JSON bodies. If fetch mocking is not already available, use `vi.stubGlobal("fetch", ...)`.

**Step 2: Run tests**

Run: `bun run --filter=@bossbench/core test packages/core/src/ui/lib/api.test.ts`

Expected: FAIL because methods do not exist.

**Step 3: Implement methods**

Add:

```ts
bulkRetryJobs: (ids: string[]) => fetchJson("/jobs/bulk/retry", { method: "POST", body: JSON.stringify({ ids }) }),
bulkCancelJobs: (ids: string[]) => fetchJson("/jobs/bulk/cancel", { method: "POST", body: JSON.stringify({ ids }) }),
bulkDeleteJobs: (ids: string[]) => fetchJson("/jobs/bulk/delete", { method: "POST", body: JSON.stringify({ ids }) }),
```

**Step 4: Run tests**

Run: `bun run --filter=@bossbench/core test packages/core/src/ui/lib/api.test.ts`

Expected: PASS.

## Task 5: Jobs page filter controls and pagination

**Files:**
- Modify: `packages/core/src/ui/pages.tsx`
- Modify if needed: `packages/core/src/ui/lib/hooks.ts`
- Modify if needed: `packages/core/src/ui/styles/globals.css`

**Step 1: Identify reusable UI primitives**

Read these files before editing:

- `packages/core/src/ui/components/shared/smart-search.tsx`
- `packages/core/src/ui/components/ui/button.tsx`
- `packages/core/src/ui/components/ui/input.tsx`
- `packages/core/src/ui/components/shared/sortable-header.tsx`

**Step 2: Add state shape**

In `RunsPage`, track:

- `queue`
- `state`
- `from`
- `to`
- `tagValues: Record<string, string>`
- `limit`
- `offset`
- `sort`

Use configured tags from `useConfig()` and queue options from `useQueues()`.

**Step 3: Build filters**

Pass to `useJobs()`:

```ts
{
  q: searchQuery || undefined,
  queue: queue === "all" ? undefined : queue,
  state: state === "all" ? undefined : state,
  from: from || undefined,
  to: to || undefined,
  sort,
  limit,
  offset,
  tags: Object.fromEntries(Object.entries(tagValues).filter(([, value]) => value).map(([key, value]) => [key, [value]])),
}
```

**Step 4: Update hook typing**

Change `useJobs()` in `packages/core/src/ui/lib/hooks.ts` to accept `QueryFilters` or a compatible full filter type, and include `from`, `to`, `offset`, and `tags` in the query key.

**Step 5: Add controls**

Add controls to Jobs page actions:

- queue select with all queues;
- state select;
- from/to datetime-local or text inputs;
- one text input per configured tag;
- page size select or fixed limit control;
- previous/next buttons.

Keep UI simple and shippable; do not build a full faceted-search component in this wave.

**Step 6: Reset offset on filter changes**

When search, queue, state, dates, tags, or sort changes, set `offset` back to `0`.

**Step 7: Run typecheck**

Run: `bun run --filter=@bossbench/core typecheck`

Expected: PASS.

## Task 6: Job selection and bulk action UI

**Files:**
- Modify: `packages/core/src/ui/pages.tsx`
- Modify if needed: `packages/core/src/ui/styles/globals.css`

**Step 1: Add selection state**

In `RunsPage`, track `selectedIds: Set<string>`.

**Step 2: Add table checkboxes**

Add a checkbox column:

- header checkbox selects/deselects visible rows;
- row checkbox toggles one job;
- clear selections when filters/page changes.

**Step 3: Add bulk action bar**

When selections exist, show a compact action bar with:

- selected count;
- Retry selected;
- Cancel selected;
- Delete selected.

Disable actions when `!config.hasBoss || config.readonly` and show explanatory copy.

**Step 4: Wire actions**

Call client API bulk methods. After success:

- display result summary in banner;
- clear selection;
- refetch or reload jobs.

For delete, use `window.confirm()` in this wave to avoid designing a modal.

**Step 5: Run typecheck**

Run: `bun run --filter=@bossbench/core typecheck`

Expected: PASS.

## Task 7: Styling pass for filters, pagination, and bulk action bar

**Files:**
- Modify: `packages/core/src/ui/styles/globals.css`

**Step 1: Add compact layout classes**

Add classes for:

- `.jobs-toolbar`
- `.filter-grid`
- `.bulk-action-bar`
- `.pagination-row`
- `.checkbox-cell`

**Step 2: Preserve responsive behavior**

At tablet/mobile widths, filters should wrap and not overflow the shell.

**Step 3: Manual visual smoke**

Run a demo or story-equivalent app if available:

Run: `bun run --filter=@bossbench/example-demo dev`

Expected: dashboard loads and Jobs page controls are usable.

## Task 8: Integration and regression checks

**Files:**
- Review all modified files.

**Step 1: Run focused tests**

Run:

```bash
bun run --filter=@bossbench/core test packages/core/src/api/handlers.test.ts packages/core/src/ui/lib/api.test.ts
```

Expected: PASS.

**Step 2: Run core typecheck**

Run:

```bash
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

**Step 3: Run broader validation**

Run:

```bash
bun run lint
bun run typecheck
bun run test
```

Expected: PASS.

**Step 4: Run integration tests if Postgres is available**

Run:

```bash
docker compose up -d --pull never postgres
bun run test:integration
```

Expected: PASS.

**Step 5: Run smoke if build artifacts are available or build is acceptable**

Run:

```bash
bun run smoke
```

Expected: PASS or documented skip for unavailable local Postgres outside CI.

## Task 9: Documentation and issue closure notes

**Files:**
- Modify: `README.md` if user-facing behavior changes need documenting.
- Modify: `packages/core/README.md` if API or UI capabilities are documented there.

**Step 1: Document job browsing controls**

Add a short note listing advanced job filters and bulk actions.

**Step 2: Document safety semantics**

Mention that bulk actions require a `PgBoss` instance and are disabled in read-only mode.

**Step 3: Validation**

Run: `bun run lint`

Expected: PASS.

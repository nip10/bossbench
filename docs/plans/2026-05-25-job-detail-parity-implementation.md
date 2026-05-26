# Job Detail Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade Bossbench job detail with Workbench-quality tabs, metadata, copy actions, and JSON export while preserving pg-boss-native read-only semantics.

**Architecture:** Keep all data reads on the existing `GET /api/jobs/:id` path and current `JobDetail` DTO. Add pure UI helper functions for JSON serialization/export payloads, then refactor `JobPage` into a richer header, summary metadata grid, and local tabs. No backend route or database changes are expected.

**Tech Stack:** Bun, TypeScript, React 19, TanStack Router, TanStack Query, existing Bossbench UI primitives, Vitest.

---

## Important execution notes

- Use TDD for helper behavior.
- Do not add clone/requeue in this wave.
- Do not add BullMQ-only concepts such as flows, promote, or queue pause/resume.
- Do not edit arbitrary job payloads or states.
- Keep routes unchanged.

## Task 1: Add job detail helper tests and helpers

**Files:**
- Create: `packages/core/src/ui/lib/job-detail.ts`
- Create: `packages/core/src/ui/lib/job-detail.test.ts`

**Step 1: Write failing tests**

Create tests for these helpers:

```ts
import { describe, expect, it } from "vitest";
import type { JobDetail } from "../../core/types";
import {
  buildJobExport,
  jobExportFilename,
  stringifyForClipboard,
} from "./job-detail";

const job: JobDetail = {
  id: "job-123",
  name: "email",
  queue: "email",
  state: "failed",
  createdOn: "2026-05-25T10:00:00.000Z",
  startedOn: "2026-05-25T10:01:00.000Z",
  completedOn: "2026-05-25T10:02:00.000Z",
  priority: 5,
  data: { teamId: "alpha" },
  output: { error: "boom" },
  retryCount: 2,
  retryLimit: 3,
  singletonKey: "single",
  expireInSeconds: 60,
  deadLetter: { name: "dead" },
  raw: { id: "job-123", name: "email" },
};

describe("job detail helpers", () => {
  it("stringifies clipboard values deterministically", () => {
    expect(stringifyForClipboard({ b: 1 })).toBe('{\n  "b": 1\n}');
    expect(stringifyForClipboard(undefined)).toBe("undefined");
  });

  it("builds a safe export filename", () => {
    expect(jobExportFilename("job/123:abc")).toBe("bossbench-job-job-123-abc.json");
  });

  it("builds full job export payload", () => {
    expect(buildJobExport(job)).toMatchObject({
      exportedBy: "Bossbench",
      job: {
        id: "job-123",
        queue: "email",
        data: { teamId: "alpha" },
        output: { error: "boom" },
      },
    });
  });
});
```

**Step 2: Run tests to verify failure**

Run from repo root:

```bash
bun run --filter=@bossbench/core test -- src/ui/lib/job-detail.test.ts
```

Expected: FAIL because `./job-detail` does not exist.

**Step 3: Implement helpers**

Create `packages/core/src/ui/lib/job-detail.ts`:

```ts
import type { JobDetail } from "../../core/types";

export function stringifyForClipboard(value: unknown): string {
  const text = JSON.stringify(value, null, 2);
  return text === undefined ? String(value) : text;
}

export function jobExportFilename(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `bossbench-job-${safe || "job"}.json`;
}

export function buildJobExport(job: JobDetail) {
  return {
    exportedBy: "Bossbench",
    exportedAt: new Date().toISOString(),
    job: {
      id: job.id,
      name: job.name,
      queue: job.queue,
      state: job.state,
      createdOn: job.createdOn,
      startedOn: job.startedOn,
      completedOn: job.completedOn,
      priority: job.priority,
      data: job.data,
      output: job.output,
      retryCount: job.retryCount,
      retryLimit: job.retryLimit,
      singletonKey: job.singletonKey,
      expireInSeconds: job.expireInSeconds,
      deadLetter: job.deadLetter ?? null,
      raw: job.raw,
    },
  };
}
```

In tests, avoid asserting exact `exportedAt`; use `expect.any(String)`.

**Step 4: Run tests**

Run:

```bash
bun run --filter=@bossbench/core test -- src/ui/lib/job-detail.test.ts
```

Expected: PASS.

## Task 2: Refactor JobPage header and action state

**Files:**
- Modify: `packages/core/src/ui/pages.tsx`

**Step 1: Add local state**

In `JobPage`, add:

- `activeTab`, default `"summary"`;
- `copyState`, for copy/export feedback;
- `actionState`, changed from string to structured state if helpful;
- `actionInFlight` or equivalent guard.

**Step 2: Lock mutation actions**

Update `runAction()`:

- return early if an action is already running;
- use `window.confirm()` before delete;
- disable all mutation buttons while in flight;
- after success, invalidate job, jobs, queues, overview/dead-letter where practical instead of `window.location.reload()`.

Use `useQueryClient()` and existing `queryKeys` / `queryPrefixes` from `packages/core/src/ui/lib/hooks.ts`.

**Step 3: Build header card**

Replace current first `Section` header/actions with a job detail header layout:

- title/name;
- status badge;
- job id mono text;
- copy id button;
- export JSON button;
- Retry/Cancel/Resume/Delete buttons;
- browse-only hint when actions disabled.

Keep all button labels text-visible.

**Step 4: Run typecheck**

Run:

```bash
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

## Task 3: Add summary metadata grid and tabs

**Files:**
- Modify: `packages/core/src/ui/pages.tsx`

**Step 1: Add tab type and metadata helper**

In `pages.tsx`, add a local type:

```ts
type JobDetailTab = "summary" | "payload" | "output" | "raw";
```

Create a local array of tab definitions in `JobPage`.

**Step 2: Add tablist**

Add accessible tab buttons:

- `role="tablist"` on container;
- each button `role="tab"`;
- `aria-selected` and `aria-controls`;
- panels `role="tabpanel"`.

**Step 3: Add Summary tab**

Summary tab should show metadata cards/rows for:

- Queue;
- State;
- Created;
- Started;
- Completed;
- Priority;
- Retry count;
- Retry limit;
- Singleton key;
- Expiration seconds;
- Dead-letter indicator.

**Step 4: Add Payload/Output/Raw tabs**

Each tab should include:

- a copy JSON button;
- `JsonViewer` with appropriate data;
- output/raw default collapsed where useful.

**Step 5: Run typecheck**

Run:

```bash
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

## Task 4: Implement copy/export interactions

**Files:**
- Modify: `packages/core/src/ui/pages.tsx`
- Modify: `packages/core/src/ui/lib/job-detail.ts` only if helper gaps appear

**Step 1: Wire copy helper**

Import `stringifyForClipboard`, `buildJobExport`, and `jobExportFilename`.

Add `copyText(label, text)`:

- call `navigator.clipboard.writeText(text)`;
- show success feedback;
- catch errors and show failure feedback.

**Step 2: Wire export helper**

Add `exportJob(job)`:

- build export payload;
- stringify with `stringifyForClipboard`;
- create Blob URL;
- create anchor;
- set filename from `jobExportFilename(job.id)`;
- click and revoke URL.

**Step 3: Connect buttons**

- Copy ID copies `job.id`.
- Copy Payload copies `job.data` JSON.
- Copy Output copies `job.output ?? null` JSON.
- Copy Raw copies `job.raw` JSON.
- Export button downloads full job export.

**Step 4: Run focused tests and typecheck**

Run:

```bash
bun run --filter=@bossbench/core test -- src/ui/lib/job-detail.test.ts
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

## Task 5: Styling and accessibility polish

**Files:**
- Modify: `packages/core/src/ui/styles/globals.css`
- Modify: `packages/core/src/ui/pages.tsx` only for class names/ARIA refinements

**Step 1: Add styles**

Add classes for:

- `.job-detail-header`;
- `.job-detail-title`;
- `.job-detail-actions`;
- `.job-detail-meta-grid`;
- `.job-detail-meta-card`;
- `.job-detail-tabs`;
- `.job-detail-tab`;
- `.job-detail-panel`;
- `.job-detail-panel-head`.

**Step 2: Ensure responsive behavior**

Header actions and metadata cards should wrap on tablet/mobile widths.

**Step 3: Ensure focus visibility**

Tab buttons and copy/export controls should have visible `:focus-visible` styles consistent with existing button focus styles.

**Step 4: Run lint/typecheck**

Run:

```bash
bun run --filter=@bossbench/core lint
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

## Task 6: Documentation and issue note

**Files:**
- Modify: `docs/plans/2026-05-25-job-detail-parity-design.md` only if implementation changed design materially.

**Step 1: Update issue #20 after implementation**

After merge/PR creation, comment on #20 with:

- tabs added;
- copy/export actions added;
- clone/requeue intentionally deferred;
- verification summary.

Do not close #20 until the PR is merged unless instructed.

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
- test exits 0;
- build exits 0;
- integration exits 0 when local Postgres is available;
- smoke exits 0.

If Docker/Postgres is unavailable, document the exact failure and run all non-integration checks.

## CI note

This PR is expected to use the base CI workflow with full checkout history for commitlint.

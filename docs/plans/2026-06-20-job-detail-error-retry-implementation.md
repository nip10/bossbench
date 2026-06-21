# Job Detail Error Retry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add pg-boss-native failure, retry, and dead-letter context to the existing job detail page.

**Architecture:** Keep repository/API data unchanged and derive all new context from the existing `JobDetail` object in pure UI helper functions. Render compact context cards in the Summary tab and richer derived context in the existing Timeline tab without adding BullMQ-style logs or fake per-attempt history.

**Tech Stack:** TypeScript, React 19, TanStack Router/Query, Vitest, Biome, Bun workspaces, existing Bossbench UI CSS.

---

## Notes for implementers

- Work from the repo root: `/Users/dc/dev/bossbench`.
- Follow TDD. Write failing tests before implementation.
- Commit steps are included because this plan is written for a normal execution lane. In this environment, only run the commit steps if the user has explicitly authorized commits; otherwise skip commits and report the uncommitted changes.
- Do not add a backend query, schema migration, dependency, or new tab unless a prior task explicitly says to.
- Preserve existing job actions: retry, enqueue copy, cancel, resume, delete, copy, and export.

## Relevant files

- Design: `docs/plans/2026-06-20-job-detail-error-retry-design.md`
- Existing helper: `packages/core/src/ui/lib/job-detail.ts`
- Existing helper tests: `packages/core/src/ui/lib/job-detail.test.ts`
- Job detail UI: `packages/core/src/ui/pages.tsx:1856-2244`
- Existing styles: `packages/core/src/ui/styles/globals.css:773-938`
- Parity tracker: `docs/workbench-parity-tracker.md:59-66,142-146`

---

### Task 1: Add failing helper tests for derived job context

**Files:**
- Modify: `packages/core/src/ui/lib/job-detail.test.ts`
- Later modify: `packages/core/src/ui/lib/job-detail.ts`

**Step 1: Import the new helper before it exists**

In `packages/core/src/ui/lib/job-detail.test.ts`, update the import block:

```ts
import {
  buildJobExport,
  buildJobOperationalContext,
  buildJobTimeline,
  jobExportFilename,
  stringifyForClipboard,
} from "./job-detail";
```

**Step 2: Add a local job fixture helper**

Near the top of `job-detail.test.ts`, after imports, add:

```ts
const baseJob = {
  id: "job-1",
  name: "email-send",
  queue: "email",
  state: "completed" as const,
  failureSnippet: null,
  createdOn: "2024-01-01T00:00:00.000Z",
  startAfter: null,
  startedOn: "2024-01-01T00:01:00.000Z",
  completedOn: "2024-01-01T00:02:00.000Z",
  priority: 1,
  data: { userId: "user-1" },
  output: null,
  retryCount: 0,
  retryLimit: 3,
  singletonKey: null,
  expireInSeconds: null,
  deadLetter: null,
  raw: {},
};
```

Do not refactor all existing tests to use this fixture in this task. Keep the first test minimal and easy to review.

**Step 3: Add tests for no-context and failed-job context**

Append this describe block before `describe("jobExportFilename", ...)`:

```ts
describe("buildJobOperationalContext", () => {
  it("returns no cards or next checks for successful jobs without retry context", () => {
    expect(buildJobOperationalContext(baseJob)).toEqual({
      cards: [],
      nextChecks: [],
    });
  });

  it("summarizes failed jobs with safe failure snippets", () => {
    const context = buildJobOperationalContext({
      ...baseJob,
      state: "failed",
      failureSnippet: "Retryable failure: smtp timeout",
      output: { message: "Retryable failure: smtp timeout" },
      retryCount: 3,
      retryLimit: 3,
    });

    expect(context.cards).toContainEqual({
      title: "Failure",
      description: "Retryable failure: smtp timeout",
      tone: "danger",
    });
    expect(context.cards).toContainEqual({
      title: "Retries",
      description: "3 of 3 retries recorded; retry limit reached.",
      tone: "warning",
    });
    expect(context.nextChecks).toContain(
      "Inspect Output JSON for the task result or error payload.",
    );
    expect(context.nextChecks).toContain(
      "Check worker and downstream service logs around the completion time.",
    );
  });
});
```

**Step 4: Run the focused test and verify it fails**

Run:

```bash
bun run --filter=@bossbench/core test -- src/ui/lib/job-detail.test.ts
```

Expected: FAIL because `buildJobOperationalContext` is not exported from `./job-detail`.

**Step 5: Commit if authorized**

If commits are explicitly authorized, run:

```bash
git add packages/core/src/ui/lib/job-detail.test.ts
git commit -m "test: cover job detail operational context"
```

Expected: commit succeeds. If commits are not authorized, skip this step.

---

### Task 2: Implement the helper and richer timeline context

**Files:**
- Modify: `packages/core/src/ui/lib/job-detail.ts`
- Modify: `packages/core/src/ui/lib/job-detail.test.ts`

**Step 1: Extend the timeline event kind union**

In `packages/core/src/ui/lib/job-detail.ts`, update `JobTimelineEvent["kind"]` to include failure context:

```ts
export type JobTimelineEvent = {
  kind:
    | "created"
    | "scheduled"
    | "started"
    | "completed"
    | "failure"
    | "retry"
    | "dead-letter"
    | "state";
  title: string;
  description: string;
  timestamp: string | null;
  display: "timeline" | "context";
};
```

**Step 2: Add exported context types**

Add below `JobTimelineEvent`:

```ts
export type JobOperationalContextTone = "neutral" | "warning" | "danger";

export type JobOperationalContextCard = {
  title: string;
  description: string;
  tone: JobOperationalContextTone;
};

export type JobOperationalContext = {
  cards: JobOperationalContextCard[];
  nextChecks: string[];
};
```

**Step 3: Add `buildJobOperationalContext`**

Add this function after `buildJobExport`:

```ts
export function buildJobOperationalContext(
  job: JobDetail,
): JobOperationalContext {
  const cards: JobOperationalContextCard[] = [];
  const nextChecks: string[] = [];
  const hasOutput = hasDiagnosticValue(job.output);
  const hasDeadLetter = job.deadLetter !== null && job.deadLetter !== undefined;
  const hasFailureContext =
    job.state === "failed" || !!job.failureSnippet || hasDeadLetter;

  if (hasFailureContext) {
    cards.push({
      title: "Failure",
      description:
        job.failureSnippet ??
        (job.state === "failed"
          ? "Job is failed, but no concise failure output is available."
          : "Failure-related metadata is available for inspection."),
      tone: job.state === "failed" ? "danger" : "warning",
    });
  }

  if (job.retryCount > 0 || job.state === "retry") {
    cards.push({
      title: "Retries",
      description: retryDescription(job.retryCount, job.retryLimit),
      tone: "warning",
    });
  }

  if (hasDeadLetter) {
    cards.push({
      title: "Dead letter",
      description:
        "Dead-letter metadata is present. Inspect Raw JSON for the full pg-boss row.",
      tone: "danger",
    });
  }

  if (hasOutput && (hasFailureContext || job.state === "retry")) {
    nextChecks.push("Inspect Output JSON for the task result or error payload.");
  }
  if (job.retryCount > 0 || job.state === "retry") {
    nextChecks.push("Compare retry count with the configured retry policy.");
  }
  if (hasDeadLetter) {
    nextChecks.push("Inspect Raw JSON for dead-letter metadata.");
  }
  if (job.state === "failed") {
    nextChecks.push(
      "Check worker and downstream service logs around the completion time.",
    );
  }

  return { cards, nextChecks: [...new Set(nextChecks)] };
}
```

**Step 4: Add private helper functions**

Add these near the bottom of `job-detail.ts`, before `terminalTitle`:

```ts
function hasDiagnosticValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function retryDescription(retryCount: number, retryLimit: number | null) {
  if (retryLimit === null) {
    return `${retryCount} retries recorded; retry limit is not available in this pg-boss row.`;
  }
  if (retryCount >= retryLimit) {
    return `${retryCount} of ${retryLimit} retries recorded; retry limit reached.`;
  }
  const remaining = retryLimit - retryCount;
  return `${retryCount} of ${retryLimit} retries recorded; ${remaining} ${
    remaining === 1 ? "retry remains" : "retries remain"
  }.`;
}
```

**Step 5: Add failure context to `buildJobTimeline`**

In `buildJobTimeline`, after the `completedOn` block and before the retry block, add:

```ts
  if (job.state === "failed" || job.failureSnippet) {
    events.push({
      kind: "failure",
      title: "Failure context",
      description:
        job.failureSnippet ??
        "Job is failed, but no concise failure output is available.",
      timestamp: null,
      display: "context",
    });
  }
```

Then replace the existing retry event description:

```ts
description: retryDescription(job.retryCount, job.retryLimit),
```

**Step 6: Add timeline test coverage**

In `job-detail.test.ts`, add a test inside `describe("buildJobTimeline", ...)`:

```ts
  it("adds untimestamped failure context for failed jobs", () => {
    const events = buildJobTimeline({
      ...baseJob,
      state: "failed",
      failureSnippet: "database timeout",
      completedOn: "2024-01-01T00:03:00.000Z",
    });

    expect(events).toContainEqual({
      kind: "failure",
      title: "Failure context",
      description: "database timeout",
      timestamp: null,
      display: "context",
    });
  });
```

If TypeScript rejects `baseJob` because of widened literal types, import `type JobDetail` from `../../core/types` and declare `const baseJob: JobDetail = { ... }`.

**Step 7: Run the focused tests and verify they pass**

Run:

```bash
bun run --filter=@bossbench/core test -- src/ui/lib/job-detail.test.ts
```

Expected: PASS for all `job-detail.test.ts` tests.

**Step 8: Commit if authorized**

If commits are explicitly authorized, run:

```bash
git add packages/core/src/ui/lib/job-detail.ts packages/core/src/ui/lib/job-detail.test.ts
git commit -m "feat: derive job failure retry context"
```

Expected: commit succeeds. If commits are not authorized, skip this step.

---

### Task 3: Render operational context in the Summary tab

**Files:**
- Modify: `packages/core/src/ui/pages.tsx:84-89`
- Modify: `packages/core/src/ui/pages.tsx:1938-2151`

**Step 1: Import the helper**

In `packages/core/src/ui/pages.tsx`, update the `./lib/job-detail` import:

```ts
import {
  buildJobExport,
  buildJobOperationalContext,
  buildJobTimeline,
  jobExportFilename,
  stringifyForClipboard,
} from "./lib/job-detail";
```

**Step 2: Build context after timeline variables**

After the existing `timelineContext` declaration, add:

```ts
  const operationalContext = buildJobOperationalContext(job);
  const hasOperationalContext =
    operationalContext.cards.length > 0 || operationalContext.nextChecks.length > 0;
```

If Biome wraps the line differently, accept its formatting.

**Step 3: Render the context section in the Summary panel**

In the Summary panel (`renderPanel("summary", ...)`), keep the existing metadata grid and add the following immediately after the grid:

```tsx
            {hasOperationalContext ? (
              <div className="job-operational-context">
                <div className="job-detail-panel-head">
                  <div>
                    <h3>Failure and retry context</h3>
                    <p>
                      Derived from pg-boss job row data. Bossbench only shows
                      context that is available in this job record.
                    </p>
                  </div>
                </div>
                {operationalContext.cards.length ? (
                  <div className="job-operational-card-grid">
                    {operationalContext.cards.map((card) => (
                      <div
                        className={`job-operational-card ${card.tone}`}
                        key={`${card.title}-${card.description}`}
                      >
                        <span>{card.title}</span>
                        <strong>{card.description}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
                {operationalContext.nextChecks.length ? (
                  <div className="job-next-checks">
                    <span>Next checks</span>
                    <ul>
                      {operationalContext.nextChecks.map((check) => (
                        <li key={check}>{check}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
```

**Step 4: Run typecheck to catch React/TypeScript errors**

Run:

```bash
bun run --filter=@bossbench/core typecheck
```

Expected: PASS. If it fails, fix only the type or JSX issue introduced in this task.

**Step 5: Commit if authorized**

If commits are explicitly authorized, run:

```bash
git add packages/core/src/ui/pages.tsx
git commit -m "feat: show job failure retry summary"
```

Expected: commit succeeds. If commits are not authorized, skip this step.

---

### Task 4: Add minimal styles for the new Summary context

**Files:**
- Modify: `packages/core/src/ui/styles/globals.css:913-938`

**Step 1: Add styles near existing job detail metadata styles**

In `packages/core/src/ui/styles/globals.css`, after `.job-detail-meta-card strong`, add:

```css
.job-operational-context {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  display: grid;
  gap: 12px;
}
.job-operational-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}
.job-operational-card {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
  padding: 12px;
  display: grid;
  gap: 8px;
  min-width: 0;
}
.job-operational-card.warning {
  border-color: rgba(245, 158, 11, 0.32);
  background: rgba(245, 158, 11, 0.08);
}
.job-operational-card.danger {
  border-color: rgba(239, 68, 68, 0.36);
  background: rgba(239, 68, 68, 0.08);
}
.job-operational-card span,
.job-next-checks span {
  color: var(--muted-foreground);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.job-operational-card strong {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.job-next-checks {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.02);
  display: grid;
  gap: 8px;
}
.job-next-checks ul {
  margin: 0;
  padding-left: 18px;
  color: var(--muted-foreground);
}
.job-next-checks li + li {
  margin-top: 4px;
}
```

**Step 2: Run lint for CSS formatting**

Run:

```bash
bun run --filter=@bossbench/core lint
```

Expected: PASS. If it fails with formatting issues, run:

```bash
bun run --filter=@bossbench/core lint -- --write
```

Then inspect the diff before continuing.

**Step 3: Commit if authorized**

If commits are explicitly authorized, run:

```bash
git add packages/core/src/ui/styles/globals.css
git commit -m "style: polish job failure retry context"
```

Expected: commit succeeds. If commits are not authorized, skip this step.

---

### Task 5: Update parity docs after implementation passes

**Files:**
- Modify: `docs/workbench-parity-tracker.md:59-66`

**Step 1: Update the job detail parity row**

In `docs/workbench-parity-tracker.md`, update the row for `Job error/retry history detail` from `Gap` to `Adapted` after implementation and tests pass.

Suggested replacement:

```markdown
| Job error/retry history detail | Adapted | Bossbench surfaces safe pg-boss-native failure snippets, retry count/limit context, dead-letter presence, Output/Raw inspection guidance, and timeline context. Full BullMQ-style per-attempt logs remain a non-goal because pg-boss does not store that history in the job row. | [#12](https://github.com/nip10/bossbench/issues/12) |
```

**Step 2: Update remaining priority order**

If no deeper job-detail follow-up remains, update the priority list so command-center polish becomes first:

```markdown
1. Continue dashboard command-center polish: richer overview/alerts/live cues and optional sidebar/command palette polish.
2. Keep desktop parity deferred through [#14](https://github.com/nip10/bossbench/issues/14) and child issues [#29–#34](https://github.com/nip10/bossbench/issues?q=is%3Aissue%20state%3Aopen%20label%3Adesktop) until desktop work is explicitly resumed.
```

If the implementation feels partial, instead keep job detail as a remaining priority but change wording to “continue deepening.”

**Step 3: Commit if authorized**

If commits are explicitly authorized, run:

```bash
git add docs/workbench-parity-tracker.md
git commit -m "docs: update job detail parity status"
```

Expected: commit succeeds. If commits are not authorized, skip this step.

---

### Task 6: Final verification

**Files:**
- Verify: all files touched by previous tasks

**Step 1: Run focused test**

Run:

```bash
bun run --filter=@bossbench/core test -- src/ui/lib/job-detail.test.ts
```

Expected: PASS.

**Step 2: Run core test suite**

Run:

```bash
bun run --filter=@bossbench/core test
```

Expected: PASS.

**Step 3: Run typecheck**

Run:

```bash
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

**Step 4: Run lint**

Run:

```bash
bun run --filter=@bossbench/core lint
```

Expected: PASS.

**Step 5: Inspect diff**

Run:

```bash
git diff -- packages/core/src/ui/lib/job-detail.ts packages/core/src/ui/lib/job-detail.test.ts packages/core/src/ui/pages.tsx packages/core/src/ui/styles/globals.css docs/workbench-parity-tracker.md
```

Expected: diff only contains the job detail context helper/tests/UI/styles and parity tracker update.

**Step 6: Final commit if authorized and prior commits were skipped**

If commits are explicitly authorized and previous commit steps were skipped, run:

```bash
git add packages/core/src/ui/lib/job-detail.ts packages/core/src/ui/lib/job-detail.test.ts packages/core/src/ui/pages.tsx packages/core/src/ui/styles/globals.css docs/workbench-parity-tracker.md
git commit -m "feat: add job detail error retry context"
```

Expected: commit succeeds. If commits are not authorized, skip this step and report the verification results plus uncommitted files.

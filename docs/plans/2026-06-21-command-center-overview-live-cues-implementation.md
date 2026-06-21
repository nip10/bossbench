# Command Center Overview Live Cues Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a richer pg-boss-native Overview command center with a live status strip and visual queue health cards.

**Architecture:** Keep the change frontend-only. Derive all new Overview UI state from existing `useOverview()` and `useMetrics()` data using pure helpers in `packages/core/src/ui/lib/dashboard-polish.ts`, then render the derived status/cards in `OverviewPage` and style them with existing dashboard card patterns.

**Tech Stack:** TypeScript, React 19, TanStack Query/Router, Vitest, Biome, Bun workspaces, existing Bossbench CSS.

---

## Notes for implementers

- Work from a clean feature worktree. Do not mix this with the separate React Doctor working-tree edits unless the user explicitly asks to combine them.
- Design doc: `docs/plans/2026-06-21-command-center-overview-live-cues-design.md`
- Follow TDD for helper behavior. Write failing tests before helper implementation.
- Do not add backend endpoints, database queries, polling, websockets, chart libraries, or UI dependencies.
- Preserve existing Overview sections. Add the status strip and queue health cards; do not remove the dense queue table.
- Commit steps are listed for normal execution. In environments requiring explicit commit authorization, skip commit steps until the user authorizes commits.

## Relevant files

- Modify: `packages/core/src/ui/lib/dashboard-polish.ts`
- Test: `packages/core/src/ui/lib/dashboard-polish.test.ts`
- Modify: `packages/core/src/ui/pages.tsx:323-554`
- Modify: `packages/core/src/ui/styles/globals.css:269-342,399-458`
- Modify docs after implementation: `docs/workbench-parity-tracker.md:49-55,142-145`

---

### Task 1: Add failing helper tests

**Files:**
- Modify: `packages/core/src/ui/lib/dashboard-polish.test.ts`
- Later modify: `packages/core/src/ui/lib/dashboard-polish.ts`

**Step 1: Import planned helpers before they exist**

Update the import block in `packages/core/src/ui/lib/dashboard-polish.test.ts`:

```ts
import {
  buildOverviewAttentionSignals,
  buildOverviewLiveStatus,
  buildOverviewQueueHealthCards,
  dashboardRefreshCue,
  dashboardShellHeightDeclaration,
  sidebarQueueListLimit,
} from "./dashboard-polish";
```

**Step 2: Add a test for live status copy**

Append inside `describe("dashboard polish helpers", ...)`:

```ts
it("summarizes overview and metrics live status", () => {
  const now = Date.now();
  const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

  try {
    expect(
      buildOverviewLiveStatus({
        overviewUpdatedAt: now - 12_000,
        metricsUpdatedAt: now - 8_000,
        metricsLoading: false,
        metricsError: null,
        hasMetrics: true,
      }),
    ).toEqual({
      tone: "success",
      title: "Live command center",
      detail: "Overview synced 12s ago. Health metrics synced 8s ago.",
      meta: "Metrics current",
    });

    expect(
      buildOverviewLiveStatus({
        overviewUpdatedAt: now - 30_000,
        metricsUpdatedAt: null,
        metricsLoading: true,
        metricsError: null,
        hasMetrics: false,
      }),
    ).toMatchObject({
      tone: "info",
      meta: "Loading health metrics",
    });

    expect(
      buildOverviewLiveStatus({
        overviewUpdatedAt: now - 30_000,
        metricsUpdatedAt: now - 120_000,
        metricsLoading: false,
        metricsError: "database unavailable",
        hasMetrics: true,
      }),
    ).toMatchObject({
      tone: "warning",
      meta: "Showing cached health metrics",
    });
  } finally {
    nowSpy.mockRestore();
  }
});
```

**Step 3: Add a test for queue health card ordering and fallback metrics**

Append another test:

```ts
it("builds priority-ordered overview queue health cards", () => {
  const cards = buildOverviewQueueHealthCards(
    [
      {
        name: "quiet",
        total: 2,
        created: 0,
        retry: 0,
        active: 0,
        completed: 2,
        cancelled: 0,
        failed: 0,
      },
      {
        name: "retry-heavy",
        total: 7,
        created: 1,
        retry: 4,
        active: 0,
        completed: 2,
        cancelled: 0,
        failed: 0,
      },
      {
        name: "email",
        total: 10,
        created: 2,
        retry: 1,
        active: 1,
        completed: 3,
        cancelled: 0,
        failed: 3,
      },
    ],
    [
      {
        name: "email",
        created: 10,
        completed: 6,
        failed: 3,
        retry: 1,
        errorRate: 0.5,
        avgDurationMs: 12_000,
        avgWaitMs: 5_000,
        lastActivity: null,
      },
    ],
  );

  expect(cards.map((card) => card.name)).toEqual([
    "email",
    "retry-heavy",
    "quiet",
  ]);
  expect(cards[0]).toMatchObject({
    tone: "critical",
    label: "Failing",
    href: "/queues/email",
    errorRate: "50%",
    avgWait: "5s",
    avgDuration: "12s",
  });
  expect(cards[1]).toMatchObject({
    tone: "warning",
    label: "Retry backlog",
    errorRate: "—",
  });
});
```

**Step 4: Add an empty queue behavior test**

Append:

```ts
it("returns no queue health cards when overview has no queues", () => {
  expect(buildOverviewQueueHealthCards([], [])).toEqual([]);
});
```

**Step 5: Run the focused tests and verify they fail**

Run:

```bash
bun run --filter=@bossbench/core test -- src/ui/lib/dashboard-polish.test.ts
```

Expected: FAIL because `buildOverviewLiveStatus` and `buildOverviewQueueHealthCards` are not exported yet.

**Step 6: Commit if authorized**

```bash
git add packages/core/src/ui/lib/dashboard-polish.test.ts
git commit -m "test: cover overview command center helpers"
```

Skip this commit step unless commits are authorized.

---

### Task 2: Implement overview command-center helpers

**Files:**
- Modify: `packages/core/src/ui/lib/dashboard-polish.ts`
- Test: `packages/core/src/ui/lib/dashboard-polish.test.ts`

**Step 1: Add exported types after `DashboardAttentionSignal`**

```ts
export type OverviewLiveStatus = {
  tone: "success" | "info" | "warning";
  title: string;
  detail: string;
  meta: string;
};

export type OverviewQueueHealthTone = "critical" | "warning" | "info" | "neutral";

export type OverviewQueueHealthCard = {
  name: string;
  href: string;
  tone: OverviewQueueHealthTone;
  label: string;
  detail: string;
  created: string;
  retry: string;
  active: string;
  failed: string;
  errorRate: string;
  avgWait: string;
  avgDuration: string;
};
```

**Step 2: Add `buildOverviewLiveStatus`**

```ts
export function buildOverviewLiveStatus({
  overviewUpdatedAt,
  metricsUpdatedAt,
  metricsLoading,
  metricsError,
  hasMetrics,
}: {
  overviewUpdatedAt: number | null | undefined;
  metricsUpdatedAt: number | null | undefined;
  metricsLoading: boolean;
  metricsError: string | null | undefined;
  hasMetrics: boolean;
}): OverviewLiveStatus {
  const overviewSync = overviewUpdatedAt
    ? `Overview synced ${formatRelativeTime(overviewUpdatedAt)}`
    : "Overview live";

  if (metricsLoading && !hasMetrics) {
    return {
      tone: "info",
      title: "Live command center",
      detail: `${overviewSync}. Health metrics are loading.`,
      meta: "Loading health metrics",
    };
  }

  if (metricsError) {
    return {
      tone: hasMetrics ? "warning" : "warning",
      title: "Live command center",
      detail: hasMetrics
        ? `${overviewSync}. Health metrics last synced ${formatRelativeTime(metricsUpdatedAt ?? overviewUpdatedAt ?? Date.now())}.`
        : `${overviewSync}. Health metrics are unavailable.`,
      meta: hasMetrics
        ? "Showing cached health metrics"
        : "Health metrics unavailable",
    };
  }

  if (hasMetrics) {
    return {
      tone: "success",
      title: "Live command center",
      detail: `${overviewSync}. Health metrics synced ${formatRelativeTime(metricsUpdatedAt ?? overviewUpdatedAt ?? Date.now())}.`,
      meta: "Metrics current",
    };
  }

  return {
    tone: "info",
    title: "Live command center",
    detail: `${overviewSync}. Queue counts are available; health metrics have not reported yet.`,
    meta: "Queue counts only",
  };
}
```

**Step 3: Add `buildOverviewQueueHealthCards`**

```ts
export function buildOverviewQueueHealthCards(
  queues: OverviewStats["queues"],
  metricsQueues: QueueMetricSummary[] | null | undefined,
  limit = 6,
): OverviewQueueHealthCard[] {
  const metricsByName = new Map(
    (metricsQueues ?? []).map((queue) => [queue.name, queue]),
  );

  return queues
    .map((queue) => {
      const metrics = metricsByName.get(queue.name);
      const status = queueHealthStatus(queue, metrics);

      return {
        name: queue.name,
        href: `/queues/${encodeURIComponent(queue.name)}`,
        tone: status.tone,
        label: status.label,
        detail: status.detail,
        created: queue.created.toLocaleString(),
        retry: queue.retry.toLocaleString(),
        active: queue.active.toLocaleString(),
        failed: queue.failed.toLocaleString(),
        errorRate: metrics ? formatPercent(metrics.errorRate) : "—",
        avgWait: metrics ? formatDurationMs(metrics.avgWaitMs) : "—",
        avgDuration: metrics ? formatDurationMs(metrics.avgDurationMs) : "—",
      };
    })
    .sort((left, right) => queueHealthRank(right) - queueHealthRank(left) || left.name.localeCompare(right.name))
    .slice(0, limit);
}
```

If Biome wraps the `.sort()` line, accept its formatting.

**Step 4: Add private ranking helpers**

Add below existing helper functions:

```ts
function queueHealthStatus(
  queue: OverviewStats["queues"][number],
  metrics: QueueMetricSummary | undefined,
) {
  const slowMs = Math.max(metrics?.avgWaitMs ?? 0, metrics?.avgDurationMs ?? 0);

  if (queue.failed > 0 || (metrics?.errorRate ?? 0) >= 0.1) {
    return {
      tone: "critical" as const,
      label: "Failing",
      detail: `${queue.failed.toLocaleString()} failed jobs need review`,
    };
  }

  if (queue.retry > 0) {
    return {
      tone: "warning" as const,
      label: "Retry backlog",
      detail: `${queue.retry.toLocaleString()} jobs waiting to retry`,
    };
  }

  if (slowMs >= 30_000) {
    return {
      tone: "info" as const,
      label: "Slow",
      detail: `Slowest signal ${formatDurationMs(slowMs)}`,
    };
  }

  if (queue.created > 0 || queue.active > 0) {
    return {
      tone: "info" as const,
      label: "Busy",
      detail: `${(queue.created + queue.active).toLocaleString()} jobs pending or active`,
    };
  }

  return {
    tone: "neutral" as const,
    label: "Quiet",
    detail: "No immediate queue pressure",
  };
}

function queueHealthRank(card: OverviewQueueHealthCard) {
  if (card.tone === "critical") return 4;
  if (card.label === "Retry backlog") return 3;
  if (card.label === "Busy") return 2;
  if (card.label === "Slow") return 1;
  return 0;
}
```

**Step 5: Run focused tests**

Run:

```bash
bun run --filter=@bossbench/core test -- src/ui/lib/dashboard-polish.test.ts
```

Expected: PASS.

**Step 6: Run typecheck for helper types**

Run:

```bash
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

**Step 7: Commit if authorized**

```bash
git add packages/core/src/ui/lib/dashboard-polish.ts packages/core/src/ui/lib/dashboard-polish.test.ts
git commit -m "feat: derive overview command center health"
```

Skip this commit step unless commits are authorized.

---

### Task 3: Render live strip and queue health cards

**Files:**
- Modify: `packages/core/src/ui/pages.tsx:323-554`

**Step 1: Import the new helpers**

Update the `./lib/dashboard-polish` import in `packages/core/src/ui/pages.tsx`:

```ts
import {
  buildOverviewAttentionSignals,
  buildOverviewLiveStatus,
  buildOverviewQueueHealthCards,
} from "./lib/dashboard-polish";
```

**Step 2: Read query update timestamps**

Change the Overview hooks to include `dataUpdatedAt`:

```ts
const {
  data,
  isLoading,
  error,
  dataUpdatedAt: overviewUpdatedAt,
} = useOverview();
const {
  data: metricsData,
  isLoading: metricsLoading,
  error: metricsError,
  dataUpdatedAt: metricsUpdatedAt,
} = useMetrics();
```

**Step 3: Build derived UI data**

After `attentionSignals`:

```ts
const liveStatus = buildOverviewLiveStatus({
  overviewUpdatedAt,
  metricsUpdatedAt,
  metricsLoading,
  metricsError: metricsError?.message,
  hasMetrics: !!metricsData,
});
const queueHealthCards = buildOverviewQueueHealthCards(
  overview.queues,
  queueMetrics,
);
```

**Step 4: Render the live strip after top summary cards**

Immediately after the first `stats-grid`, add:

```tsx
<div className={`overview-live-strip overview-live-${liveStatus.tone}`}>
  <div>
    <span>{liveStatus.title}</span>
    <strong>{liveStatus.meta}</strong>
  </div>
  <p>{liveStatus.detail}</p>
</div>
```

**Step 5: Render queue health cards before the dense queue table**

At the start of the `Queues` section, before `<Table ...>`, add:

```tsx
{queueHealthCards.length ? (
  <div className="queue-health-card-grid">
    {queueHealthCards.map((queue) => (
      <Link
        key={queue.name}
        to="/queues/$queueName"
        params={{ queueName: queue.name } as never}
        className={`queue-health-card queue-health-${queue.tone}`}
      >
        <div className="queue-health-card-head">
          <span>{queue.label}</span>
          <strong className="mono">{queue.name}</strong>
        </div>
        <p>{queue.detail}</p>
        <div className="queue-health-card-gridlet">
          <span>Created <strong>{queue.created}</strong></span>
          <span>Retry <strong>{queue.retry}</strong></span>
          <span>Active <strong>{queue.active}</strong></span>
          <span>Failed <strong>{queue.failed}</strong></span>
        </div>
        <div className="queue-health-card-metrics">
          <span>Error {queue.errorRate}</span>
          <span>Wait {queue.avgWait}</span>
          <span>Duration {queue.avgDuration}</span>
        </div>
      </Link>
    ))}
  </div>
) : (
  <div className="banner compact">No queues discovered yet.</div>
)}
```

Keep the existing table immediately after this block.

**Step 6: Run typecheck**

Run:

```bash
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

**Step 7: Commit if authorized**

```bash
git add packages/core/src/ui/pages.tsx
git commit -m "feat: render overview command center cards"
```

Skip this commit step unless commits are authorized.

---

### Task 4: Add styles for the live strip and queue cards

**Files:**
- Modify: `packages/core/src/ui/styles/globals.css`

**Step 1: Add live strip styles near attention/overview styles**

Add after `.attention-info` or near `.stats-grid`:

```css
.overview-live-strip {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.025);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.overview-live-strip div {
  display: grid;
  gap: 4px;
}
.overview-live-strip span {
  color: var(--muted-foreground);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.overview-live-strip strong {
  font-size: 14px;
}
.overview-live-strip p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12px;
  text-align: right;
}
.overview-live-success {
  border-color: rgba(34, 197, 94, 0.28);
}
.overview-live-info {
  border-color: rgba(59, 130, 246, 0.28);
}
.overview-live-warning {
  border-color: rgba(245, 158, 11, 0.32);
}
```

**Step 2: Add queue health card styles near metrics/table styles**

```css
.queue-health-card-grid {
  padding: 0 14px 14px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.queue-health-card {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
  padding: 12px;
  display: grid;
  gap: 10px;
  color: var(--foreground);
  text-decoration: none;
}
.queue-health-card:hover {
  border-color: rgba(255, 255, 255, 0.24);
}
.queue-health-critical {
  border-color: rgba(239, 68, 68, 0.32);
}
.queue-health-warning {
  border-color: rgba(245, 158, 11, 0.32);
}
.queue-health-info {
  border-color: rgba(59, 130, 246, 0.28);
}
.queue-health-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}
.queue-health-card-head span {
  color: var(--muted-foreground);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.queue-health-card p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12px;
}
.queue-health-card-gridlet,
.queue-health-card-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  color: var(--muted-foreground);
  font-size: 12px;
}
.queue-health-card-gridlet strong {
  color: var(--foreground);
  font-weight: 600;
}
.queue-health-card-metrics {
  grid-template-columns: 1fr;
}
```

**Step 3: Add responsive style**

Near existing media queries:

```css
@media (max-width: 720px) {
  .overview-live-strip {
    display: grid;
  }
  .overview-live-strip p {
    text-align: left;
  }
}
```

If an existing `@media (max-width: 720px)` block exists, merge these selectors into it.

**Step 4: Run lint**

Run:

```bash
bun run --filter=@bossbench/core lint
```

Expected: PASS. Fix formatting only if Biome reports CSS formatting.

**Step 5: Commit if authorized**

```bash
git add packages/core/src/ui/styles/globals.css
git commit -m "style: add overview command center cards"
```

Skip this commit step unless commits are authorized.

---

### Task 5: Update parity tracker after implementation

**Files:**
- Modify: `docs/workbench-parity-tracker.md`

**Step 1: Update date**

Change:

```markdown
Last updated: 2026-06-20
```

to:

```markdown
Last updated: 2026-06-21
```

If the file already has a newer date, keep the newer date.

**Step 2: Update Overview command center row**

Update the row to mention the new live strip and queue health cards while still acknowledging remaining sidebar/palette polish:

```markdown
| Overview command center | Adapted | Bossbench uses Overview as home with summary cards, attention signals, a live/synced status strip, metrics-driven throughput/wait/duration cards, queue health cards, and slow/failing queue tables. Workbench remains richer for worker/paused-queue health and broader shell affordances. | [#58](https://github.com/nip10/bossbench/issues/58) |
```

**Step 3: Update Queue overview cards/grid row**

```markdown
| Queue overview cards/grid | Adapted | Bossbench adds visual queue health cards on Overview plus queue table/detail pages; Workbench queue cards remain more visually rich and BullMQ-specific. | [#9](https://github.com/nip10/bossbench/issues/9) |
```

**Step 4: Update remaining priority wording**

If the priority list still says command-center polish broadly, narrow it:

```markdown
1. Continue dashboard shell polish: optional collapsible sidebar and broader command-palette actions.
2. Keep desktop parity deferred through [#14](https://github.com/nip10/bossbench/issues/14) and child issues [#29–#34](https://github.com/nip10/bossbench/issues?q=is%3Aissue%20state%3Aopen%20label%3Adesktop) until desktop work is explicitly resumed.
```

**Step 5: Commit if authorized**

```bash
git add docs/workbench-parity-tracker.md
git commit -m "docs: update command center parity status"
```

Skip this commit step unless commits are authorized.

---

### Task 6: Final verification

**Files:**
- Verify all touched files.

**Step 1: Run focused tests**

```bash
bun run --filter=@bossbench/core test -- src/ui/lib/dashboard-polish.test.ts
```

Expected: PASS.

**Step 2: Run core tests**

```bash
bun run --filter=@bossbench/core test
```

Expected: PASS.

**Step 3: Run typecheck**

```bash
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

**Step 4: Run lint**

```bash
bun run --filter=@bossbench/core lint
```

Expected: PASS.

**Step 5: Run React Doctor changed-scope scan**

```bash
npx react-doctor@latest --verbose --scope changed
```

Expected: no new changed-source failures. Existing full-repo warnings may remain outside this scope.

**Step 6: Inspect diff**

```bash
git diff -- packages/core/src/ui/lib/dashboard-polish.ts packages/core/src/ui/lib/dashboard-polish.test.ts packages/core/src/ui/pages.tsx packages/core/src/ui/styles/globals.css docs/workbench-parity-tracker.md
```

Expected: diff contains only command-center helper/tests/UI/styles/docs changes.

**Step 7: Final commit if authorized and previous commits were skipped**

```bash
git add packages/core/src/ui/lib/dashboard-polish.ts packages/core/src/ui/lib/dashboard-polish.test.ts packages/core/src/ui/pages.tsx packages/core/src/ui/styles/globals.css docs/workbench-parity-tracker.md
git commit -m "feat: add overview command center live cues"
```

Skip this commit step unless commits are authorized.

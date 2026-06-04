# Upstream Alerting and Docs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port Workbench's latest alerting/docs/marketing work into Bossbench as pg-boss-native alerting, safe delivery, and clearer docs/discoverability.

**Architecture:** Implement alerting in stages: read-only config and evaluation first, then dashboard/API visibility, then optional outbound delivery, then Slack/Discord adapters, then docs/marketing polish. Alert evaluation reads pg-boss/Postgres state through Bossbench's repository layer; delivery is opt-in server-side polling with dedupe/cooldown and no default writes to pg-boss tables.

**Tech Stack:** TypeScript, pg-boss, Postgres, React, TanStack Router/Query, Vitest, Bun, GitHub CLI.

**Design:** `docs/plans/2026-06-04-upstream-alerting-docs-design.md`

**Issues:** #71, #72, #73, #74, #75

**Important workspace note:** the original workspace had local modifications in `packages/core/README.md`, `packages/core/src/ui/lib/api.test.ts`, and `packages/core/src/ui/pages.tsx`, but this plan is being executed in the isolated worktree. Stage only files changed by the current task.

---

### Task 1: Update upstream audit tracker and roadmap references

**Issue:** #75

**Files:**
- Modify: `docs/workbench-parity-tracker.md:3-43`
- Modify: `docs/workbench-parity-tracker.md:45-145`

**Step 1: Update the audit header**

Change the last audit line to:

```markdown
Last upstream audit: 2026-06-04, [`pontusab/workbench@aefd22c`](https://github.com/pontusab/workbench/commit/aefd22c11cbebc26c619df201641995e661af624) after previously checked [`4937b37`](https://github.com/pontusab/workbench/commit/4937b37).
```

**Step 2: Append the new audit row**

Add after the `e4bab1d..4937b37` row:

```markdown
| 2026-06-04 | [`4937b37..aefd22c`](https://github.com/pontusab/workbench/compare/4937b37...aefd22c11cbebc26c619df201641995e661af624) | Workbench 0.8.0 added self-hosted alerting with Slack and webhook destinations, then 0.9.1 added Discord as an official alert channel. The web app also gained a structured docs hub with setup, framework, deployment, and alerting docs plus minor marketing cleanup. | Opened Bossbench follow-ups for pg-boss-native alert evaluation and Alerts UI (#71), alert delivery (#72), Slack/Discord formatting (#73), docs expansion (#74), and marketing/discoverability cleanup (#75). Bossbench will adapt alerting through SQL-backed pg-boss evaluation rather than BullMQ `QueueEvents`. |
```

**Step 3: Add dashboard/product parity row**

In the dashboard UI table, add an alerting row near Overview/Warnings:

```markdown
| Alerts dashboard | Planned | Workbench now has alert rules, contact points, and delivery history. Bossbench should add a pg-boss-native Alerts page that starts with configured rules and current SQL-backed violations before delivery. | [#71](https://github.com/nip10/bossbench/issues/71) |
```

**Step 4: Add backend/API parity row**

In the backend/API table, add:

```markdown
| Alert evaluation and delivery | Planned | Workbench uses BullMQ `QueueEvents`; Bossbench should use pg-boss/Postgres polling, conservative dedupe/cooldown, and optional webhook delivery. | [#71](https://github.com/nip10/bossbench/issues/71), [#72](https://github.com/nip10/bossbench/issues/72), [#73](https://github.com/nip10/bossbench/issues/73) |
```

**Step 5: Update ecosystem/docs row**

Adjust the marketing/docs row to mention structured docs are now tracked in #74.

**Step 6: Verify**

Run:

```bash
git diff -- docs/workbench-parity-tracker.md
```

Expected: only parity tracker content changes.

**Step 7: Commit**

Only if the user has explicitly requested commits for this branch:

```bash
git add docs/workbench-parity-tracker.md docs/plans/2026-06-04-upstream-alerting-docs-design.md docs/plans/2026-06-04-upstream-alerting-docs-implementation.md
git commit -m "docs: track upstream alerting parity"
```

---

### Task 2: Add alerting config types and normalization

**Issue:** #71

**Files:**
- Modify: `packages/core/src/core/types.ts`
- Modify: `packages/core/src/core/options.ts`
- Modify: `packages/core/src/core/options.test.ts`
- Modify: `packages/core/src/core/core.ts`

**Step 1: Write failing options tests**

Add tests to `packages/core/src/core/options.test.ts`:

```ts
it("defaults alerting to disabled", () => {
  const options = normalizeOptions({
    db: "postgres://example",
    allowUnauthenticated: true,
  });

  expect(options.alerts).toEqual({ enabled: false, rules: [], contactPoints: [] });
});

it("normalizes configured alert rules and contact points", () => {
  const options = normalizeOptions({
    db: "postgres://example",
    allowUnauthenticated: true,
    alerts: {
      enabled: true,
      rules: [
        {
          id: "email-failures",
          name: "Email failures",
          type: "failed_count",
          queue: "email",
          windowMinutes: 15,
          threshold: 5,
          severity: "critical",
          cooldownMinutes: 30,
          contactPointIds: ["ops"],
        },
      ],
      contactPoints: [
        { id: "ops", name: "Ops webhook", type: "webhook", urlEnv: "OPS_WEBHOOK_URL" },
      ],
    },
  });

  expect(options.alerts.enabled).toBe(true);
  expect(options.alerts.rules).toHaveLength(1);
  expect(options.alerts.contactPoints).toHaveLength(1);
});

it("rejects invalid alert thresholds", () => {
  expect(() =>
    normalizeOptions({
      db: "postgres://example",
      allowUnauthenticated: true,
      alerts: {
        enabled: true,
        rules: [{ id: "bad", name: "Bad", type: "failed_count", threshold: 0 }],
      },
    }),
  ).toThrow("Alert rule threshold must be greater than 0");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
bun test packages/core/src/core/options.test.ts
```

Expected: FAIL because `alerts` types/normalization do not exist yet.

**Step 3: Add alerting types**

Add to `packages/core/src/core/types.ts`:

```ts
export type BossbenchAlertRuleType =
  | "failed_count"
  | "dead_letter_count"
  | "retry_backlog_count"
  | "oldest_created_age"
  | "avg_wait_ms"
  | "avg_duration_ms"
  | "warning_count";

export type BossbenchAlertSeverity = "info" | "warning" | "critical";

export interface BossbenchAlertRule {
  id: string;
  name: string;
  type: BossbenchAlertRuleType;
  queue?: string;
  windowMinutes?: number;
  threshold: number;
  severity?: BossbenchAlertSeverity;
  cooldownMinutes?: number;
  contactPointIds?: string[];
}

export type BossbenchAlertContactPointType = "webhook" | "slack" | "discord";

export interface BossbenchAlertContactPoint {
  id: string;
  name: string;
  type: BossbenchAlertContactPointType;
  url?: string;
  urlEnv?: string;
}

export interface BossbenchAlertsOptions {
  enabled?: boolean;
  rules?: BossbenchAlertRule[];
  contactPoints?: BossbenchAlertContactPoint[];
}

export interface NormalizedBossbenchAlertsOptions {
  enabled: boolean;
  rules: BossbenchAlertRule[];
  contactPoints: BossbenchAlertContactPoint[];
}
```

Then add `alerts?: BossbenchAlertsOptions` to `BossbenchOptions` and `alerts: NormalizedBossbenchAlertsOptions` to `NormalizedBossbenchOptions`.

**Step 4: Normalize alerts**

Add a helper in `packages/core/src/core/options.ts`:

```ts
function normalizeAlerts(
  alerts: BossbenchOptions["alerts"],
): NormalizedBossbenchOptions["alerts"] {
  const normalized = {
    enabled: alerts?.enabled ?? false,
    rules: alerts?.rules ?? [],
    contactPoints: alerts?.contactPoints ?? [],
  };

  for (const rule of normalized.rules) {
    if (!rule.id.trim()) throw new Error("Alert rule id is required");
    if (!rule.name.trim()) throw new Error("Alert rule name is required");
    if (rule.threshold <= 0)
      throw new Error("Alert rule threshold must be greater than 0");
    if (rule.windowMinutes !== undefined && rule.windowMinutes <= 0)
      throw new Error("Alert rule windowMinutes must be greater than 0");
    if (rule.cooldownMinutes !== undefined && rule.cooldownMinutes < 0)
      throw new Error("Alert rule cooldownMinutes must be non-negative");
  }

  for (const contactPoint of normalized.contactPoints) {
    if (!contactPoint.id.trim()) throw new Error("Alert contact point id is required");
    if (!contactPoint.name.trim()) throw new Error("Alert contact point name is required");
    if (!contactPoint.url && !contactPoint.urlEnv)
      throw new Error("Alert contact point requires url or urlEnv");
  }

  return normalized;
}
```

Call it in the returned normalized options:

```ts
alerts: normalizeAlerts(options.alerts),
```

**Step 5: Expose config state**

Modify `packages/core/src/core/core.ts` so `getConfig()` includes:

```ts
alerts: {
  enabled: this.options.alerts.enabled,
  ruleCount: this.options.alerts.rules.length,
  contactPointCount: this.options.alerts.contactPoints.length,
},
```

Do not include raw contact point URLs.

**Step 6: Run tests**

Run:

```bash
bun test packages/core/src/core/options.test.ts packages/core/src/core/core.test.ts
```

Expected: PASS.

**Step 7: Commit**

Only if commits are explicitly requested:

```bash
git add packages/core/src/core/types.ts packages/core/src/core/options.ts packages/core/src/core/options.test.ts packages/core/src/core/core.ts
git commit -m "feat: add alerting configuration"
```

---

### Task 3: Add read-only alert evaluator

**Issue:** #71

**Files:**
- Create: `packages/core/src/core/alerts.ts`
- Create: `packages/core/src/core/alerts.test.ts`
- Modify: `packages/core/src/core/types.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Add alert response types**

Add to `types.ts`:

```ts
export interface BossbenchAlertViolation {
  ruleId: string;
  ruleName: string;
  type: BossbenchAlertRuleType;
  severity: BossbenchAlertSeverity;
  queue: string | null;
  threshold: number;
  current: number;
  windowMinutes: number | null;
  observedAt: string;
  fingerprint: string;
}

export interface BossbenchAlertsResponse {
  enabled: boolean;
  rules: BossbenchAlertRule[];
  contactPoints: Array<{
    id: string;
    name: string;
    type: BossbenchAlertContactPointType;
    configured: boolean;
  }>;
  violations: BossbenchAlertViolation[];
  delivery: {
    enabled: boolean;
    available: boolean;
  };
}

export interface AlertEvaluationSnapshot {
  overview: OverviewStats;
  metrics: MetricsResponse;
  warnings: PaginatedResponse<WarningInfo>;
}
```

**Step 2: Write evaluator tests**

Create `packages/core/src/core/alerts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateAlertRules, maskContactPoints } from "./alerts";
import type { AlertEvaluationSnapshot, BossbenchAlertRule } from "./types";

const snapshot: AlertEvaluationSnapshot = {
  overview: {
    totals: { created: 3, retry: 4, active: 0, completed: 10, cancelled: 0, failed: 6 },
    queues: [
      { name: "email", total: 12, created: 2, retry: 3, active: 0, completed: 4, cancelled: 0, failed: 3 },
      { name: "billing", total: 11, created: 1, retry: 1, active: 0, completed: 6, cancelled: 0, failed: 3 },
    ],
    deadLetter: 6,
    warnings: 2,
  },
  metrics: {
    summary: {
      totalCreated: 3,
      totalCompleted: 10,
      totalFailed: 6,
      totalRetry: 4,
      throughputPerHour: 1,
      errorRate: 0.2,
      avgDurationMs: 1200,
      avgWaitMs: 800,
    },
    buckets: [],
    queues: [
      { name: "email", created: 2, completed: 4, failed: 3, retry: 3, errorRate: 0.4, avgDurationMs: 1500, avgWaitMs: 900, lastActivity: null },
    ],
  },
  warnings: { items: [], page: 1, pageSize: 200, total: 2 },
};

describe("evaluateAlertRules", () => {
  it("returns violations when rule thresholds are crossed", () => {
    const rules: BossbenchAlertRule[] = [
      { id: "failed", name: "Failed jobs", type: "failed_count", threshold: 5, severity: "critical" },
      { id: "retry", name: "Retry backlog", type: "retry_backlog_count", queue: "email", threshold: 2 },
    ];

    const violations = evaluateAlertRules(rules, snapshot, new Date("2026-06-04T12:00:00.000Z"));

    expect(violations).toHaveLength(2);
    expect(violations[0]).toMatchObject({ ruleId: "failed", current: 6, threshold: 5, severity: "critical" });
    expect(violations[1]).toMatchObject({ ruleId: "retry", queue: "email", current: 3 });
  });

  it("does not return violations below threshold", () => {
    const violations = evaluateAlertRules(
      [{ id: "failed", name: "Failed jobs", type: "failed_count", threshold: 10 }],
      snapshot,
      new Date("2026-06-04T12:00:00.000Z"),
    );

    expect(violations).toEqual([]);
  });
});

describe("maskContactPoints", () => {
  it("does not expose contact point URLs", () => {
    expect(
      maskContactPoints([
        { id: "ops", name: "Ops", type: "webhook", url: "https://example.test/hook" },
      ]),
    ).toEqual([{ id: "ops", name: "Ops", type: "webhook", configured: true }]);
  });
});
```

**Step 3: Run tests to verify failure**

Run:

```bash
bun test packages/core/src/core/alerts.test.ts
```

Expected: FAIL because `alerts.ts` does not exist.

**Step 4: Implement evaluator**

Create `packages/core/src/core/alerts.ts`:

```ts
import type {
  AlertEvaluationSnapshot,
  BossbenchAlertContactPoint,
  BossbenchAlertRule,
  BossbenchAlertViolation,
} from "./types";

export function evaluateAlertRules(
  rules: BossbenchAlertRule[],
  snapshot: AlertEvaluationSnapshot,
  observedAt = new Date(),
): BossbenchAlertViolation[] {
  const observed = observedAt.toISOString();
  return rules.flatMap((rule) => {
    const current = currentValue(rule, snapshot);
    if (current < rule.threshold) return [];
    const queue = rule.queue ?? null;
    return [
      {
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        severity: rule.severity ?? "warning",
        queue,
        threshold: rule.threshold,
        current,
        windowMinutes: rule.windowMinutes ?? null,
        observedAt: observed,
        fingerprint: [rule.id, rule.type, queue ?? "all"].join(":"),
      },
    ];
  });
}

export function maskContactPoints(contactPoints: BossbenchAlertContactPoint[]) {
  return contactPoints.map((contactPoint) => ({
    id: contactPoint.id,
    name: contactPoint.name,
    type: contactPoint.type,
    configured: !!(contactPoint.url || contactPoint.urlEnv),
  }));
}

function currentValue(rule: BossbenchAlertRule, snapshot: AlertEvaluationSnapshot) {
  const queue = rule.queue ? snapshot.overview.queues.find((item) => item.name === rule.queue) : null;
  const queueMetric = rule.queue ? snapshot.metrics.queues.find((item) => item.name === rule.queue) : null;

  switch (rule.type) {
    case "failed_count":
      return queue?.failed ?? snapshot.overview.totals.failed;
    case "dead_letter_count":
      return snapshot.overview.deadLetter;
    case "retry_backlog_count":
      return queue?.retry ?? snapshot.overview.totals.retry;
    case "oldest_created_age":
      return 0;
    case "avg_wait_ms":
      return queueMetric?.avgWaitMs ?? snapshot.metrics.summary.avgWaitMs ?? 0;
    case "avg_duration_ms":
      return queueMetric?.avgDurationMs ?? snapshot.metrics.summary.avgDurationMs ?? 0;
    case "warning_count":
      return snapshot.overview.warnings;
  }
}
```

`oldest_created_age` intentionally returns `0` until Task 4 adds a repository query for it.

**Step 5: Export utilities**

Update `packages/core/src/index.ts` if public type exports require explicit exports.

**Step 6: Run tests**

Run:

```bash
bun test packages/core/src/core/alerts.test.ts
```

Expected: PASS.

**Step 7: Commit**

Only if commits are explicitly requested:

```bash
git add packages/core/src/core/alerts.ts packages/core/src/core/alerts.test.ts packages/core/src/core/types.ts packages/core/src/index.ts
git commit -m "feat: add alert evaluator"
```

---

### Task 4: Add alerts repository/API response

**Issue:** #71

**Files:**
- Modify: `packages/core/src/core/repository.ts`
- Modify: `packages/core/src/core/repository.test.ts`
- Modify: `packages/core/src/core/core.ts`
- Modify: `packages/core/src/api/handlers.ts`
- Modify: `packages/core/src/api/handlers.test.ts`
- Modify: `packages/core/src/core/alerts.ts`
- Modify: `packages/core/src/core/alerts.test.ts`

**Step 1: Add repository snapshot test**

Add to `repository.test.ts` a test for `getAlertEvaluationSnapshot()` that expects calls to existing overview/metrics/warnings query paths. Keep this test light: verify it returns overview, metrics, warnings, and a created-age map when implemented.

**Step 2: Run test to verify failure**

Run:

```bash
bun test packages/core/src/core/repository.test.ts
```

Expected: FAIL because `getAlertEvaluationSnapshot()` does not exist.

**Step 3: Implement snapshot repository method**

Add to `BossbenchRepository`:

```ts
async getAlertEvaluationSnapshot(): Promise<AlertEvaluationSnapshot> {
  const [overview, metrics, warnings, oldestCreatedAges] = await Promise.all([
    this.getOverview(),
    this.getMetrics(),
    this.getWarnings(),
    this.getOldestCreatedAges(),
  ]);
  return { overview, metrics, warnings, oldestCreatedAges };
}
```

Extend `AlertEvaluationSnapshot` with:

```ts
oldestCreatedAges?: Record<string, number>;
```

Add private/public method:

```ts
async getOldestCreatedAges(): Promise<Record<string, number>> {
  const rows = await this.withClient((c) =>
    this.safeQuery<{ name: string; ageSeconds: number }>(
      c,
      `select name, coalesce(max(extract(epoch from now() - created_on)), 0)::int as "ageSeconds" from ${this.q("job")} where state in ('created','retry') group by name`,
    ),
  );
  return Object.fromEntries(rows.map((row) => [row.name, row.ageSeconds]));
}
```

Update `currentValue()` for `oldest_created_age`:

```ts
case "oldest_created_age":
  return rule.queue
    ? (snapshot.oldestCreatedAges?.[rule.queue] ?? 0)
    : Math.max(0, ...Object.values(snapshot.oldestCreatedAges ?? {}));
```

**Step 4: Add core method**

In `packages/core/src/core/core.ts`, add:

```ts
async getAlerts(): Promise<BossbenchAlertsResponse> {
  const alerts = this.options.alerts;
  const snapshot = alerts.enabled
    ? await this.repository.getAlertEvaluationSnapshot()
    : null;
  return {
    enabled: alerts.enabled,
    rules: alerts.rules,
    contactPoints: maskContactPoints(alerts.contactPoints),
    violations: snapshot ? evaluateAlertRules(alerts.rules, snapshot) : [],
    delivery: { enabled: false, available: false },
  };
}
```

Import `evaluateAlertRules` and `maskContactPoints` from `./alerts`.

**Step 5: Add API handler test**

Add to `packages/core/src/api/handlers.test.ts`:

```ts
it("returns alert state", async () => {
  const route = buildRouteTable({
    getAlerts: vi.fn().mockResolvedValue({ enabled: false, rules: [], contactPoints: [], violations: [], delivery: { enabled: false, available: false } }),
  } as never).find((candidate) => candidate.method === "get" && candidate.path === "/alerts");

  await expect(route?.handler({ params: {}, query: {} })).resolves.toEqual({
    status: 200,
    body: { enabled: false, rules: [], contactPoints: [], violations: [], delivery: { enabled: false, available: false } },
  });
});
```

Adjust the mock shape if existing handler tests use a different core stub pattern.

**Step 6: Add route**

Add to `buildRouteTable()` near overview:

```ts
{
  method: "get",
  path: "/alerts",
  handler: async () => ok(await core.getAlerts()),
},
```

**Step 7: Run tests**

Run:

```bash
bun test packages/core/src/core/alerts.test.ts packages/core/src/core/repository.test.ts packages/core/src/api/handlers.test.ts
```

Expected: PASS.

**Step 8: Commit**

Only if commits are explicitly requested:

```bash
git add packages/core/src/core/alerts.ts packages/core/src/core/alerts.test.ts packages/core/src/core/repository.ts packages/core/src/core/repository.test.ts packages/core/src/core/core.ts packages/core/src/api/handlers.ts packages/core/src/api/handlers.test.ts packages/core/src/core/types.ts
git commit -m "feat: expose alert violations API"
```

---

### Task 5: Add Alerts UI page and navigation

**Issue:** #71

**Files:**
- Modify: `packages/core/src/ui/lib/api.ts`
- Modify: `packages/core/src/ui/lib/api.test.ts`
- Modify: `packages/core/src/ui/lib/hooks.ts`
- Modify: `packages/core/src/ui/router.tsx`
- Modify: `packages/core/src/ui/pages.tsx`
- Modify: `packages/core/src/ui/components/layout/sidebar.tsx`
- Modify: `packages/core/src/ui/components/layout/command-palette.tsx`

**Step 1: Add API client test**

Add to `api.test.ts`:

```ts
it("fetches alert state", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ enabled: false, rules: [], contactPoints: [], violations: [], delivery: { enabled: false, available: false } }),
  });
  vi.stubGlobal("fetch", fetchMock);

  await api.alerts();

  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/alerts"), expect.any(Object));
});
```

Respect existing local changes in this file; inspect before editing.

**Step 2: Run test to verify failure**

Run:

```bash
bun test packages/core/src/ui/lib/api.test.ts
```

Expected: FAIL because `api.alerts()` does not exist.

**Step 3: Add API client and hook**

In `api.ts`, import `BossbenchAlertsResponse` and add:

```ts
alerts: () => fetchJson<BossbenchAlertsResponse>("/alerts"),
```

In `hooks.ts`, add:

```ts
alerts: ["alerts"] as const,
```

and:

```ts
export const useAlerts = () =>
  useQuery({
    queryKey: queryKeys.alerts,
    queryFn: api.alerts,
    refetchInterval: 30_000,
  });
```

**Step 4: Add Alerts page**

In `pages.tsx`, add `AlertsPage`:

```tsx
export function AlertsPage() {
  const { data, isLoading, error } = useAlerts();

  if (isLoading) return <PageState title="Alerts" description="Loading alert state…" />;
  if (error) return <PageState title="Alerts" description={error instanceof Error ? error.message : "Unable to load alerts"} tone="danger" />;

  if (!data?.enabled || !data.rules.length) {
    return (
      <section className="page-section">
        <SectionHeader title="Alerts" description="Configure pg-boss-native alert rules in Bossbench options to monitor failures, retries, warnings, and queue latency." />
        <EmptyState title="No alert rules configured" description="Alerting is config-driven and read-only by default. Add alert rules on the server to see current violations here." />
      </section>
    );
  }

  return (
    <section className="page-section">
      <SectionHeader title="Alerts" description="Current pg-boss alert violations and configured rules." />
      <div className="card-grid">
        <StatCard label="Current violations" value={data.violations.length} />
        <StatCard label="Rules" value={data.rules.length} />
        <StatCard label="Contact points" value={data.contactPoints.length} />
      </div>
      {/* Render violation and rule tables using existing table/card styles. */}
    </section>
  );
}
```

Use existing page primitives from `pages.tsx`; do not introduce a new design system.

**Step 5: Add route/nav**

In `router.tsx`:

- import `AlertsPage`;
- add `alertsRoute` at path `"alerts"`;
- add it to `routeTree`;
- update `nav` derivation and `title` mapping.

In `sidebar.tsx`, add `BellRing` or existing `Bell` item:

```ts
["/alerts", "Alerts", Bell],
```

In `command-palette.tsx`, add:

```ts
["/alerts", "Alerts"],
```

**Step 6: Run tests/typecheck**

Run:

```bash
bun test packages/core/src/ui/lib/api.test.ts
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

**Step 7: Commit**

Only if commits are explicitly requested:

```bash
git add packages/core/src/ui/lib/api.ts packages/core/src/ui/lib/api.test.ts packages/core/src/ui/lib/hooks.ts packages/core/src/ui/router.tsx packages/core/src/ui/pages.tsx packages/core/src/ui/components/layout/sidebar.tsx packages/core/src/ui/components/layout/command-palette.tsx
git commit -m "feat: add alerts dashboard"
```

---

### Task 6: Add webhook delivery primitives

**Issue:** #72

**Files:**
- Create: `packages/core/src/core/alert-delivery.ts`
- Create: `packages/core/src/core/alert-delivery.test.ts`
- Modify: `packages/core/src/core/types.ts`

**Step 1: Write delivery tests**

Create `alert-delivery.test.ts` with tests for:

- fingerprint cooldown suppresses duplicate sends;
- webhook payload includes rule, severity, queue, current, threshold;
- contact points resolve `url` or `urlEnv` without exposing secrets.

Use injected `fetch` and `env` objects. Do not read `process.env` directly inside pure helpers.

**Step 2: Run tests to verify failure**

Run:

```bash
bun test packages/core/src/core/alert-delivery.test.ts
```

Expected: FAIL because delivery module does not exist.

**Step 3: Implement pure delivery helpers**

In `alert-delivery.ts`, implement:

```ts
export function shouldDeliver(now: Date, lastSentAt: Date | undefined, cooldownMinutes = 0) {
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= cooldownMinutes * 60_000;
}

export function resolveContactPointUrl(contactPoint: BossbenchAlertContactPoint, env: Record<string, string | undefined>) {
  return contactPoint.url ?? (contactPoint.urlEnv ? env[contactPoint.urlEnv] : undefined);
}

export function buildWebhookPayload(violation: BossbenchAlertViolation) {
  return {
    ruleId: violation.ruleId,
    ruleName: violation.ruleName,
    type: violation.type,
    severity: violation.severity,
    queue: violation.queue,
    current: violation.current,
    threshold: violation.threshold,
    observedAt: violation.observedAt,
    fingerprint: violation.fingerprint,
  };
}
```

Keep runner/orchestration out of this task unless the helpers are stable.

**Step 4: Run tests**

Run:

```bash
bun test packages/core/src/core/alert-delivery.test.ts
```

Expected: PASS.

**Step 5: Commit**

Only if commits are explicitly requested:

```bash
git add packages/core/src/core/alert-delivery.ts packages/core/src/core/alert-delivery.test.ts packages/core/src/core/types.ts
git commit -m "feat: add alert delivery primitives"
```

---

### Task 7: Add optional alert runner

**Issue:** #72

**Files:**
- Create: `packages/core/src/core/alert-runner.ts`
- Create: `packages/core/src/core/alert-runner.test.ts`
- Modify: `packages/core/src/core/types.ts`
- Modify: `packages/core/src/core/core.ts`

**Step 1: Write runner tests**

Test a class/function that:

- calls an injected evaluator;
- filters violations by cooldown;
- sends to configured contact points;
- records in-memory `lastSentAt` by fingerprint/contact point;
- skips delivery when contact point URL is missing.

Do not require timers in the first test; call `runOnce()` directly.

**Step 2: Run test to verify failure**

Run:

```bash
bun test packages/core/src/core/alert-runner.test.ts
```

Expected: FAIL because runner does not exist.

**Step 3: Implement runner**

Create `AlertRunner` with:

```ts
type AlertRunnerDeps = {
  getAlerts: () => Promise<BossbenchAlertsResponse>;
  sendWebhook: (url: string, payload: unknown) => Promise<void>;
  env?: Record<string, string | undefined>;
  now?: () => Date;
};
```

Expose:

```ts
runOnce(): Promise<{ attempted: number; sent: number; skipped: number }>;
```

Do not start intervals automatically in constructor.

**Step 4: Wire core carefully**

Only add core-owned runner setup if the lifecycle is obvious. Otherwise keep the runner exported and add a follow-up TODO in #72 for server lifecycle integration.

**Step 5: Run tests**

Run:

```bash
bun test packages/core/src/core/alert-delivery.test.ts packages/core/src/core/alert-runner.test.ts
```

Expected: PASS.

**Step 6: Commit**

Only if commits are explicitly requested:

```bash
git add packages/core/src/core/alert-runner.ts packages/core/src/core/alert-runner.test.ts packages/core/src/core/types.ts packages/core/src/core/core.ts
git commit -m "feat: add optional alert runner"
```

---

### Task 8: Add Slack and Discord formatting adapters

**Issue:** #73

**Files:**
- Create: `packages/core/src/core/alert-destinations.ts`
- Create: `packages/core/src/core/alert-destinations.test.ts`
- Modify: `packages/core/src/core/alert-delivery.ts`
- Modify: `packages/core/src/core/types.ts`

**Step 1: Write formatting tests**

Test:

- Slack payload contains alert title, severity, queue, current, threshold.
- Discord payload contains `embeds` with title, description/fields, severity color.
- Generic webhook remains unchanged.

**Step 2: Run test to verify failure**

Run:

```bash
bun test packages/core/src/core/alert-destinations.test.ts
```

Expected: FAIL because destination formatters do not exist.

**Step 3: Implement formatters**

Create:

```ts
export function buildSlackPayload(violation: BossbenchAlertViolation) { /* simple webhook-compatible payload */ }
export function buildDiscordPayload(violation: BossbenchAlertViolation) { /* embed payload */ }
export function buildDestinationPayload(type: BossbenchAlertContactPointType, violation: BossbenchAlertViolation) { /* switch */ }
```

Avoid vendor SDKs. Webhook payloads are plain JSON.

**Step 4: Integrate with delivery helper**

Make runner/delivery call `buildDestinationPayload(contactPoint.type, violation)`.

**Step 5: Run tests**

Run:

```bash
bun test packages/core/src/core/alert-delivery.test.ts packages/core/src/core/alert-destinations.test.ts packages/core/src/core/alert-runner.test.ts
```

Expected: PASS.

**Step 6: Commit**

Only if commits are explicitly requested:

```bash
git add packages/core/src/core/alert-destinations.ts packages/core/src/core/alert-destinations.test.ts packages/core/src/core/alert-delivery.ts packages/core/src/core/types.ts
git commit -m "feat: add Slack and Discord alert destinations"
```

---

### Task 9: Add docs for alerts and upstream parity

**Issue:** #74

**Files:**
- Modify: `README.md`
- Modify: `packages/core/README.md`
- Modify: `apps/web/src/app/page.tsx`
- Optional create: `apps/web/src/app/docs/page.tsx`
- Optional create: `apps/web/src/app/docs/alerts/page.tsx`

**Step 1: Decide docs shape**

Inspect current `apps/web/src/app` structure. If adding `/docs` is small and keeps the site simple, create a lightweight docs route. If not, expand README/package docs first and leave full docs hub to a follow-up.

**Step 2: Document alerting options**

Add docs for:

- `alerts.enabled`;
- `alerts.rules`;
- `alerts.contactPoints`;
- supported rule types;
- read-only evaluation;
- delivery safety and multi-instance guidance;
- Slack/Discord/webhook configuration after delivery lands.

**Step 3: Update marketing page**

Add or adjust copy to mention alerting only after the alerting UI/API exists. Do not overclaim delivery before #72/#73 are implemented.

**Step 4: Run verification**

Run:

```bash
bun run lint
bun run --filter=@bossbench/web typecheck
```

If the web package has no typecheck script, use the root `bun run typecheck`.

Expected: PASS.

**Step 5: Commit**

Only if commits are explicitly requested:

```bash
git add README.md packages/core/README.md apps/web/src/app/page.tsx apps/web/src/app/docs
git commit -m "docs: add alerting guidance"
```

---

### Task 10: Final verification and review

**Issues:** #71, #72, #73, #74, #75

**Files:**
- All changed files

**Step 1: Inspect working tree**

Run:

```bash
git status --short
git diff --check
```

Expected: no whitespace errors; only intended files changed. Confirm pre-existing local modifications were preserved.

**Step 2: Run focused tests**

Run:

```bash
bun test packages/core/src/core/options.test.ts packages/core/src/core/alerts.test.ts packages/core/src/core/alert-delivery.test.ts packages/core/src/core/alert-destinations.test.ts packages/core/src/core/alert-runner.test.ts packages/core/src/core/repository.test.ts packages/core/src/api/handlers.test.ts packages/core/src/ui/lib/api.test.ts
```

Expected: PASS.

**Step 3: Run broader checks**

Run:

```bash
bun run typecheck
bun run lint
bun run test
```

Expected: PASS.

**Step 4: Request code review**

Use @oracle for security/safety review of:

- alerting option normalization;
- no secret leakage;
- no pg-boss table writes;
- delivery cooldown/dedupe;
- multi-instance risk;
- API/UI behavior when alerting is disabled.

Fix Critical/Important findings before completion.

**Step 5: Update issues**

Comment on #71-#75 with implementation status, tests run, and any follow-up issues. Close only issues fully satisfied by the branch.

**Step 6: Final commit**

Only if commits are explicitly requested and all checks pass:

```bash
git status --short
git add <intended-files-only>
git commit -m "feat: add pg-boss-native alerting"
```

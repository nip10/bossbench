import { describe, expect, it } from "vitest";
import { evaluateAlertRules, maskContactPoints } from "./alerts";
import type { AlertEvaluationSnapshot, BossbenchAlertRule } from "./types";

const snapshot: AlertEvaluationSnapshot = {
  overview: {
    totals: {
      created: 3,
      retry: 4,
      active: 0,
      completed: 10,
      cancelled: 0,
      failed: 6,
    },
    queues: [
      {
        name: "email",
        total: 12,
        created: 2,
        retry: 3,
        active: 0,
        completed: 4,
        cancelled: 0,
        failed: 3,
      },
      {
        name: "billing",
        total: 11,
        created: 1,
        retry: 1,
        active: 0,
        completed: 6,
        cancelled: 0,
        failed: 3,
      },
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
      {
        name: "email",
        created: 2,
        completed: 4,
        failed: 3,
        retry: 3,
        errorRate: 0.4,
        avgDurationMs: 1500,
        avgWaitMs: 900,
        lastActivity: null,
      },
    ],
  },
  warnings: { items: [], page: 1, pageSize: 200, total: 2 },
};

describe("evaluateAlertRules", () => {
  it("returns violations when rule thresholds are crossed", () => {
    const rules: BossbenchAlertRule[] = [
      {
        id: "failed",
        name: "Failed jobs",
        type: "failed_count",
        threshold: 5,
        severity: "critical",
      },
      {
        id: "retry",
        name: "Retry backlog",
        type: "retry_backlog_count",
        queue: "email",
        threshold: 2,
      },
    ];

    const violations = evaluateAlertRules(
      rules,
      snapshot,
      new Date("2026-06-04T12:00:00.000Z"),
    );

    expect(violations).toHaveLength(2);
    expect(violations[0]).toMatchObject({
      ruleId: "failed",
      current: 6,
      threshold: 5,
      severity: "critical",
      observedAt: "2026-06-04T12:00:00.000Z",
      fingerprint: "failed:failed_count:all",
    });
    expect(violations[1]).toMatchObject({
      ruleId: "retry",
      queue: "email",
      current: 3,
      severity: "warning",
      fingerprint: "retry:retry_backlog_count:email",
    });
  });

  it("does not return violations below threshold", () => {
    const violations = evaluateAlertRules(
      [
        {
          id: "failed",
          name: "Failed jobs",
          type: "failed_count",
          threshold: 10,
        },
      ],
      snapshot,
      new Date("2026-06-04T12:00:00.000Z"),
    );

    expect(violations).toEqual([]);
  });

  it("does not fall back to global values for missing queue data", () => {
    const violations = evaluateAlertRules(
      [
        {
          id: "missing-failed",
          name: "Missing failed queue",
          type: "failed_count",
          queue: "missing",
          threshold: 1,
        },
        {
          id: "missing-retry",
          name: "Missing retry queue",
          type: "retry_backlog_count",
          queue: "missing",
          threshold: 1,
        },
        {
          id: "missing-wait",
          name: "Missing wait metric",
          type: "avg_wait_ms",
          queue: "missing",
          threshold: 1,
        },
        {
          id: "missing-duration",
          name: "Missing duration metric",
          type: "avg_duration_ms",
          queue: "missing",
          threshold: 1,
        },
      ],
      snapshot,
      new Date("2026-06-04T12:00:00.000Z"),
    );

    expect(violations).toEqual([]);
  });

  it("uses rule-specific values when the repository precomputes windowed counts", () => {
    const violations = evaluateAlertRules(
      [
        {
          id: "recent-failed",
          name: "Recent failures",
          type: "failed_count",
          windowMinutes: 15,
          threshold: 3,
        },
      ],
      { ...snapshot, ruleValues: { "recent-failed": 4 } },
      new Date("2026-06-04T12:00:00.000Z"),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      ruleId: "recent-failed",
      current: 4,
      windowMinutes: 15,
    });
  });
});

describe("maskContactPoints", () => {
  it("does not expose contact point URLs", () => {
    expect(
      maskContactPoints([
        {
          id: "ops",
          name: "Ops",
          type: "webhook",
          url: "https://example.test/hook",
        },
      ]),
    ).toEqual([{ id: "ops", name: "Ops", type: "webhook", configured: true }]);
  });
});

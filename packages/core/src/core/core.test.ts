import { describe, expect, it, vi } from "vitest";
import { BossbenchCore } from "./core";

describe("BossbenchCore", () => {
  it("normalizes and exposes auth/actions flags", () => {
    const core = BossbenchCore.create({
      db: "postgres://example",
      auth: { username: "u", password: "p" },
    });
    expect(core.getConfig().schema).toBe("pgboss");
    expect(core.requiresAuth()).toBe(true);
    expect(core.validateAuth("u", "p")).toBe(true);
    expect(core.actionsEnabled()).toBe(false);
    expect(core.getConfig().allowManualEnqueue).toBe(false);
    expect(core.getConfig().alerts).toEqual({
      enabled: false,
      ruleCount: 0,
      contactPointCount: 0,
    });
  });
  it("returns safe alert state without exposing contact point secrets", async () => {
    const core = BossbenchCore.create({
      db: "postgres://example",
      allowUnauthenticated: true,
      alerts: {
        enabled: true,
        rules: [
          {
            id: "failed",
            name: "Failed jobs",
            type: "failed_count",
            threshold: 1,
            contactPointIds: ["ops"],
          },
        ],
        contactPoints: [
          {
            id: "ops",
            name: "Ops",
            type: "webhook",
            url: "https://example.test/hook",
          },
        ],
      },
    });
    (
      core.repository as unknown as { getAlertEvaluationSnapshot: unknown }
    ).getAlertEvaluationSnapshot = vi.fn(async () => ({
      overview: {
        totals: {
          created: 0,
          retry: 0,
          active: 0,
          completed: 0,
          cancelled: 0,
          failed: 2,
        },
        queues: [],
        deadLetter: 2,
        warnings: 0,
      },
      metrics: {
        summary: {
          totalCreated: 0,
          totalCompleted: 0,
          totalFailed: 2,
          totalRetry: 0,
          throughputPerHour: 0,
          errorRate: 0,
          avgDurationMs: null,
          avgWaitMs: null,
        },
        buckets: [],
        queues: [],
      },
      warnings: { items: [], page: 1, pageSize: 200, total: 0 },
    }));

    const alerts = await (
      core as unknown as { getAlerts: () => Promise<unknown> }
    ).getAlerts();

    expect(alerts).toMatchObject({
      enabled: true,
      contactPoints: [
        { id: "ops", name: "Ops", type: "webhook", configured: true },
      ],
      delivery: { enabled: false, available: false },
    });
    expect(JSON.stringify(alerts)).not.toContain("https://example.test/hook");
  });
  it("does not read alert snapshots when alerting has no rules", async () => {
    const core = BossbenchCore.create({
      db: "postgres://example",
      allowUnauthenticated: true,
      alerts: { enabled: true, rules: [] },
    });
    const getAlertEvaluationSnapshot = vi.fn();
    (
      core.repository as unknown as { getAlertEvaluationSnapshot: unknown }
    ).getAlertEvaluationSnapshot = getAlertEvaluationSnapshot;

    await expect(core.getAlerts()).resolves.toMatchObject({
      enabled: true,
      rules: [],
      violations: [],
    });
    expect(getAlertEvaluationSnapshot).not.toHaveBeenCalled();
  });
});

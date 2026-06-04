import { describe, expect, it, vi } from "vitest";
import { AlertRunner } from "./alert-runner";
import type { BossbenchAlertsResponse } from "./types";

const alertResponse: BossbenchAlertsResponse = {
  enabled: true,
  rules: [
    {
      id: "failed",
      name: "Failed jobs",
      type: "failed_count",
      threshold: 3,
      cooldownMinutes: 30,
      contactPointIds: ["ops"],
    },
  ],
  contactPoints: [
    { id: "ops", name: "Ops", type: "webhook", configured: true },
  ],
  violations: [
    {
      ruleId: "failed",
      ruleName: "Failed jobs",
      type: "failed_count",
      severity: "critical",
      queue: "email",
      threshold: 3,
      current: 5,
      windowMinutes: 15,
      observedAt: "2026-06-04T12:00:00.000Z",
      fingerprint: "failed:failed_count:email",
    },
  ],
  delivery: { enabled: false, available: false },
};

describe("AlertRunner", () => {
  it("sends violations once and respects cooldowns", async () => {
    const sendWebhook = vi.fn(async () => undefined);
    const runner = new AlertRunner({
      getAlerts: vi.fn(async () => alertResponse),
      contactPoints: [
        {
          id: "ops",
          name: "Ops",
          type: "webhook",
          url: "https://example.test/hook",
        },
      ],
      sendWebhook,
      now: () => new Date("2026-06-04T12:10:00.000Z"),
    });

    await expect(runner.runOnce()).resolves.toEqual({
      attempted: 1,
      failed: 0,
      sent: 1,
      skipped: 0,
    });
    await expect(runner.runOnce()).resolves.toEqual({
      attempted: 1,
      failed: 0,
      sent: 0,
      skipped: 1,
    });
    expect(sendWebhook).toHaveBeenCalledTimes(1);
    expect(sendWebhook).toHaveBeenCalledWith(
      "https://example.test/hook",
      expect.objectContaining({ fingerprint: "failed:failed_count:email" }),
    );
  });

  it("skips contact points without resolved URLs", async () => {
    const sendWebhook = vi.fn(async () => undefined);
    const runner = new AlertRunner({
      getAlerts: vi.fn(async () => alertResponse),
      contactPoints: [
        { id: "ops", name: "Ops", type: "webhook", urlEnv: "MISSING" },
      ],
      env: {},
      sendWebhook,
    });

    await expect(runner.runOnce()).resolves.toEqual({
      attempted: 1,
      failed: 0,
      sent: 0,
      skipped: 1,
    });
    expect(sendWebhook).not.toHaveBeenCalled();
  });

  it("continues delivering after one contact point fails", async () => {
    const sendWebhook = vi
      .fn()
      .mockRejectedValueOnce(new Error("webhook failed"))
      .mockResolvedValueOnce(undefined);
    const [rule] = alertResponse.rules;
    if (!rule) throw new Error("Expected alert rule fixture");
    const runner = new AlertRunner({
      getAlerts: vi.fn(async () => ({
        ...alertResponse,
        rules: [{ ...rule, contactPointIds: ["ops", "backup"] }],
      })),
      contactPoints: [
        {
          id: "ops",
          name: "Ops",
          type: "webhook",
          url: "https://example.test/ops",
        },
        {
          id: "backup",
          name: "Backup",
          type: "webhook",
          url: "https://example.test/backup",
        },
      ],
      sendWebhook,
    });

    await expect(runner.runOnce()).resolves.toEqual({
      attempted: 2,
      failed: 1,
      sent: 1,
      skipped: 0,
    });
    expect(sendWebhook).toHaveBeenCalledTimes(2);
  });
});

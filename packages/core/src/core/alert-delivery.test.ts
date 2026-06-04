import { describe, expect, it } from "vitest";
import {
  buildWebhookPayload,
  resolveContactPointUrl,
  shouldDeliver,
} from "./alert-delivery";
import type { BossbenchAlertViolation } from "./types";

const violation: BossbenchAlertViolation = {
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
};

describe("shouldDeliver", () => {
  it("allows first delivery and suppresses deliveries inside cooldown", () => {
    const now = new Date("2026-06-04T12:30:00.000Z");

    expect(shouldDeliver(now, undefined, 30)).toBe(true);
    expect(shouldDeliver(now, new Date("2026-06-04T12:15:00.000Z"), 30)).toBe(
      false,
    );
    expect(shouldDeliver(now, new Date("2026-06-04T11:59:00.000Z"), 30)).toBe(
      true,
    );
  });
});

describe("resolveContactPointUrl", () => {
  it("resolves inline URLs or environment-backed URLs", () => {
    expect(
      resolveContactPointUrl(
        { id: "ops", name: "Ops", type: "webhook", url: "https://inline" },
        {},
      ),
    ).toBe("https://inline");
    expect(
      resolveContactPointUrl(
        { id: "ops", name: "Ops", type: "webhook", urlEnv: "OPS_WEBHOOK" },
        { OPS_WEBHOOK: "https://env" },
      ),
    ).toBe("https://env");
  });
});

describe("buildWebhookPayload", () => {
  it("includes alert context without contact point secrets", () => {
    expect(buildWebhookPayload(violation)).toEqual({
      ruleId: "failed",
      ruleName: "Failed jobs",
      type: "failed_count",
      severity: "critical",
      queue: "email",
      current: 5,
      threshold: 3,
      observedAt: "2026-06-04T12:00:00.000Z",
      fingerprint: "failed:failed_count:email",
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  buildDestinationPayload,
  buildDiscordPayload,
  buildSlackPayload,
} from "./alert-destinations";
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

describe("alert destination payloads", () => {
  it("builds Slack webhook payloads", () => {
    expect(buildSlackPayload(violation)).toMatchObject({
      text: "Critical Bossbench alert: Failed jobs",
      blocks: expect.arrayContaining([
        expect.objectContaining({ type: "header" }),
        expect.objectContaining({ type: "section" }),
      ]),
    });
    expect(JSON.stringify(buildSlackPayload(violation))).toContain("email");
  });

  it("builds Discord embed payloads", () => {
    const payload = buildDiscordPayload(violation) as {
      embeds: Array<{ title: string; color: number }>;
    };

    expect(payload.embeds[0]?.title).toBe(
      "Critical Bossbench alert: Failed jobs",
    );
    expect(payload.embeds[0]?.color).toBe(0xdc2626);
    expect(JSON.stringify(payload)).toContain("failed_count");
  });

  it("keeps generic webhook payloads unchanged", () => {
    expect(buildDestinationPayload("webhook", violation)).toMatchObject({
      ruleId: "failed",
      fingerprint: "failed:failed_count:email",
    });
    expect(buildDestinationPayload("slack", violation)).toEqual(
      buildSlackPayload(violation),
    );
    expect(buildDestinationPayload("discord", violation)).toEqual(
      buildDiscordPayload(violation),
    );
  });
});

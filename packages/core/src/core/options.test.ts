import { describe, expect, it } from "vitest";
import { normalizeOptions } from "./options";

describe("normalizeOptions", () => {
  it("defaults schema and read-only flags for explicit unauthenticated mode", () => {
    const o = normalizeOptions({
      db: "postgres://example",
      allowUnauthenticated: true,
    });
    expect(o.schema).toBe("pgboss");
    expect(o.title).toBe("Bossbench");
    expect(o.readonly).toBe(true);
    expect(o.tags).toEqual([]);
    expect(o.allowManualEnqueue).toBe(false);
    expect(o.allowQueueClean).toBe(false);
    expect(o.allowQueueCleanDelete).toBe(false);
    expect(o.alerts).toEqual({
      enabled: false,
      rules: [],
      contactPoints: [],
    });
  });
  it("normalizes destructive queue clean and audit hook", () => {
    const onAuditEvent = async () => undefined;
    const o = normalizeOptions({
      db: "postgres://example",
      allowUnauthenticated: true,
      allowQueueCleanDelete: true,
      onAuditEvent,
    });

    expect(o.allowQueueCleanDelete).toBe(true);
    expect(o.onAuditEvent).toBe(onAuditEvent);
  });
  it("normalizes configured alert rules and contact points", () => {
    const o = normalizeOptions({
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
          {
            id: "ops",
            name: "Ops webhook",
            type: "webhook",
            urlEnv: "OPS_WEBHOOK_URL",
          },
        ],
      },
    });

    expect(o.alerts.enabled).toBe(true);
    expect(o.alerts.rules).toHaveLength(1);
    expect(o.alerts.contactPoints).toHaveLength(1);
  });
  it("rejects invalid alert thresholds", () => {
    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          enabled: true,
          rules: [
            {
              id: "bad",
              name: "Bad",
              type: "failed_count",
              threshold: 0,
            },
          ],
        },
      }),
    ).toThrow("Alert rule threshold must be greater than 0");
  });
  it("rejects incomplete alert rules and contact points", () => {
    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          rules: [
            { id: "", name: "Missing id", type: "failed_count", threshold: 1 },
          ],
        },
      }),
    ).toThrow("Alert rule id is required");

    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          rules: [{ id: "bad", name: "", type: "failed_count", threshold: 1 }],
        },
      }),
    ).toThrow("Alert rule name is required");

    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          rules: [
            {
              id: "bad",
              name: "Bad",
              type: "failed_count",
              threshold: 1,
              windowMinutes: 0,
            },
          ],
        },
      }),
    ).toThrow("Alert rule windowMinutes must be greater than 0");

    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          rules: [
            {
              id: "bad",
              name: "Bad",
              type: "failed_count",
              threshold: 1,
              cooldownMinutes: -1,
            },
          ],
        },
      }),
    ).toThrow("Alert rule cooldownMinutes must be non-negative");

    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          contactPoints: [{ id: "", name: "Ops", type: "webhook", url: "x" }],
        },
      }),
    ).toThrow("Alert contact point id is required");

    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          contactPoints: [{ id: "ops", name: "", type: "webhook", url: "x" }],
        },
      }),
    ).toThrow("Alert contact point name is required");

    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          contactPoints: [{ id: "ops", name: "Ops", type: "webhook" }],
        },
      }),
    ).toThrow("Alert contact point requires url or urlEnv");
  });
  it("rejects queue filters for global-only alert rules", () => {
    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          rules: [
            {
              id: "warnings",
              name: "Warnings",
              type: "warning_count",
              queue: "email",
              threshold: 1,
            },
          ],
        },
      }),
    ).toThrow("Alert rule type warning_count does not support queue filters");

    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          rules: [
            {
              id: "dead-letter",
              name: "Dead Letter",
              type: "dead_letter_count",
              queue: "email",
              threshold: 1,
            },
          ],
        },
      }),
    ).toThrow(
      "Alert rule type dead_letter_count does not support queue filters",
    );
  });
  it("rejects windows for oldest-created-age alert rules", () => {
    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          rules: [
            {
              id: "oldest",
              name: "Oldest queued job",
              type: "oldest_created_age",
              windowMinutes: 15,
              threshold: 300,
            },
          ],
        },
      }),
    ).toThrow("Alert rule type oldest_created_age does not support windows");
  });
  it("rejects duplicate alert ids and unknown contact point references", () => {
    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          rules: [
            { id: "same", name: "One", type: "failed_count", threshold: 1 },
            { id: "same", name: "Two", type: "failed_count", threshold: 1 },
          ],
        },
      }),
    ).toThrow("Alert rule ids must be unique");

    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          contactPoints: [
            { id: "same", name: "One", type: "webhook", url: "https://one" },
            { id: "same", name: "Two", type: "webhook", url: "https://two" },
          ],
        },
      }),
    ).toThrow("Alert contact point ids must be unique");

    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        allowUnauthenticated: true,
        alerts: {
          rules: [
            {
              id: "failed",
              name: "Failed",
              type: "failed_count",
              threshold: 1,
              contactPointIds: ["missing"],
            },
          ],
          contactPoints: [
            { id: "ops", name: "Ops", type: "webhook", url: "https://ops" },
          ],
        },
      }),
    ).toThrow("Alert rule failed references unknown contact point missing");
  });
  it("enables mutations by default when auth is configured", () => {
    const o = normalizeOptions({
      db: "postgres://example",
      auth: { username: "admin", password: "secret" },
    });
    expect(o.readonly).toBe(false);
  });
  it("requires db or boss", () => {
    expect(() => normalizeOptions({})).toThrow(
      "Bossbench requires a db connection or a pg-boss instance",
    );
  });
  it("requires non-empty auth unless unauthenticated mode is explicit", () => {
    expect(() => normalizeOptions({ db: "postgres://example" })).toThrow(
      "Bossbench requires non-empty auth or allowUnauthenticated: true",
    );
    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        auth: { username: "", password: "" },
      }),
    ).toThrow(
      "Bossbench requires non-empty auth or allowUnauthenticated: true",
    );
  });
});

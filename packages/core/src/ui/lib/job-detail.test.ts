import { describe, expect, it } from "vitest";
import {
  buildJobExport,
  buildJobOperationalContext,
  buildJobTimeline,
  jobExportFilename,
  stringifyForClipboard,
} from "./job-detail";

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

describe("stringifyForClipboard", () => {
  it("stringifies objects with two-space indentation", () => {
    expect(stringifyForClipboard({ a: 1, b: { c: 2 } })).toBe(
      '{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}',
    );
  });

  it('stringifies undefined as "undefined"', () => {
    expect(stringifyForClipboard(undefined)).toBe("undefined");
  });
});

describe("buildJobTimeline", () => {
  it("builds ordered pg-boss lifecycle events from job detail timestamps", () => {
    const events = buildJobTimeline({
      id: "job-1",
      name: "email-send",
      queue: "email",
      state: "completed",
      failureSnippet: null,
      createdOn: "2024-01-01T00:00:00.000Z",
      startAfter: "2024-01-01T00:05:00.000Z",
      startedOn: "2024-01-01T00:06:00.000Z",
      completedOn: "2024-01-01T00:08:00.000Z",
      priority: 1,
      data: {},
      output: null,
      retryCount: 2,
      retryLimit: 5,
      singletonKey: "singleton",
      expireInSeconds: 3600,
      deadLetter: { reason: "nope" },
      raw: {},
    });

    expect(events.map((event) => event.kind)).toEqual([
      "created",
      "scheduled",
      "started",
      "completed",
      "retry",
      "dead-letter",
    ]);
    expect(events[1]).toMatchObject({
      title: "Scheduled for future start",
      timestamp: "2024-01-01T00:05:00.000Z",
    });
    expect(events[4]?.description).toContain("2 of 5");
    expect(events[4]?.display).toBe("context");
    expect(events[5]?.display).toBe("context");
  });

  it("adds a current state event when terminal timestamps are absent", () => {
    const events = buildJobTimeline({
      id: "job-2",
      name: "report",
      queue: "report",
      state: "retry",
      failureSnippet: null,
      createdOn: null,
      startAfter: null,
      startedOn: null,
      completedOn: null,
      priority: null,
      data: {},
      output: null,
      retryCount: 1,
      retryLimit: null,
      singletonKey: null,
      expireInSeconds: null,
      raw: {},
    });

    expect(events.at(-1)).toMatchObject({
      kind: "state",
      title: "Current state: retry",
    });
    expect(events.at(-2)?.description).toContain(
      "retry limit is not available",
    );
  });

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
});

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
      failureSnippet: "Safe failure snippet",
      output: { message: "Raw output message" },
      retryCount: 3,
      retryLimit: 3,
    });

    expect(context.cards).toContainEqual({
      title: "Failure",
      description: "Safe failure snippet",
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

  it("treats non-nullish falsy dead letter values as present", () => {
    const context = buildJobOperationalContext({
      ...baseJob,
      deadLetter: "",
    });

    expect(context.cards).toContainEqual({
      title: "Dead letter",
      description:
        "Dead-letter metadata is present. Inspect Raw JSON for the full pg-boss row.",
      tone: "danger",
    });

    const events = buildJobTimeline({
      ...baseJob,
      deadLetter: false,
    });

    expect(events).toContainEqual({
      kind: "dead-letter",
      title: "Dead letter data present",
      description: "pg-boss recorded dead-letter metadata for this job.",
      timestamp: null,
      display: "context",
    });
  });
});

describe("jobExportFilename", () => {
  it("sanitizes invalid filename characters", () => {
    expect(jobExportFilename("job/123:abc")).toBe(
      "bossbench-job-job-123-abc.json",
    );
  });
});

describe("buildJobExport", () => {
  it("includes export metadata and the job snapshot", () => {
    const payload = buildJobExport({
      id: "job-1",
      name: "email-send",
      queue: "email",
      state: "completed",
      failureSnippet: null,
      createdOn: "2024-01-01T00:00:00.000Z",
      startAfter: null,
      startedOn: "2024-01-01T00:01:00.000Z",
      completedOn: "2024-01-01T00:02:00.000Z",
      priority: 1,
      data: { foo: "bar" },
      output: { ok: true },
      retryCount: 2,
      retryLimit: 5,
      singletonKey: "singleton",
      expireInSeconds: 3600,
      deadLetter: undefined,
      raw: { source: "db" },
    });

    expect(payload.exportedBy).toBe("Bossbench");
    expect(typeof payload.exportedAt).toBe("string");
    expect(payload.job).toEqual({
      id: "job-1",
      name: "email-send",
      queue: "email",
      state: "completed",
      failureSnippet: null,
      createdOn: "2024-01-01T00:00:00.000Z",
      startAfter: null,
      startedOn: "2024-01-01T00:01:00.000Z",
      completedOn: "2024-01-01T00:02:00.000Z",
      priority: 1,
      data: { foo: "bar" },
      output: { ok: true },
      retryCount: 2,
      retryLimit: 5,
      singletonKey: "singleton",
      expireInSeconds: 3600,
      deadLetter: null,
      raw: { source: "db" },
    });
  });
});

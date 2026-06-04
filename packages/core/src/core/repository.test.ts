import { describe, expect, it, vi } from "vitest";
import { BossbenchRepository } from "./repository";

describe("BossbenchRepository.listFutureJobs", () => {
  it("builds the future-jobs query and maps rows", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: "job-1",
            name: "email",
            queue: "email",
            state: "created",
            start_after: new Date("2026-05-26T12:00:00.000Z"),
            created_on: new Date("2026-05-26T11:00:00.000Z"),
            started_on: null,
            completed_on: null,
            priority: 1,
            data: { hello: "world" },
            output: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 2 }] });
    const client = { query } as never;
    const repository = new BossbenchRepository(client, "bossbench", []);

    const result = await repository.listFutureJobs({
      limit: 25,
      offset: 10,
    });

    expect(query.mock.calls[0]?.[0]).toContain("start_after > now()");
    expect(query.mock.calls[0]?.[0]).toContain("state in ('created','retry')");
    expect(query.mock.calls[0]?.[0]).toContain("order by start_after asc");
    expect(query.mock.calls[0]?.[0]).toContain("limit $1 offset $2");
    expect(query.mock.calls[0]?.[1]).toEqual([25, 10]);
    expect(query.mock.calls[1]?.[0]).toContain("count(*)::int as total");
    expect(query.mock.calls[1]?.[1]).toEqual([]);

    expect(result.total).toBe(2);
    expect(result.items[0]?.startAfter).toBe("2026-05-26T12:00:00.000Z");
  });
});

describe("BossbenchRepository job summaries", () => {
  it("includes a short failure snippet from pg-boss output", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: "job-1",
            name: "email",
            queue: "email",
            state: "failed",
            created_on: new Date("2026-05-26T11:00:00.000Z"),
            start_after: null,
            started_on: new Date("2026-05-26T11:01:00.000Z"),
            completed_on: new Date("2026-05-26T11:02:00.000Z"),
            priority: 1,
            data: { hello: "world" },
            output: { message: "Retryable failure: smtp timeout" },
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });
    const client = { query } as never;
    const repository = new BossbenchRepository(client, "bossbench", []);

    const result = await repository.listJobs({ state: "failed" });

    expect(query.mock.calls[0]?.[0]).not.toContain(", error");
    expect(result.items[0]?.failureSnippet).toBe(
      "Retryable failure: smtp timeout",
    );
  });
});

describe("BossbenchRepository alert snapshots", () => {
  it("combines overview, metrics, warnings, and oldest created ages", async () => {
    const repository = new BossbenchRepository(
      { query: vi.fn() } as never,
      "bossbench",
      [],
    );
    const overview = {
      totals: {
        created: 0,
        retry: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
        failed: 0,
      },
      queues: [],
      deadLetter: 0,
      warnings: 0,
    };
    const metrics = {
      summary: {
        totalCreated: 0,
        totalCompleted: 0,
        totalFailed: 0,
        totalRetry: 0,
        throughputPerHour: 0,
        errorRate: 0,
        avgDurationMs: null,
        avgWaitMs: null,
      },
      buckets: [],
      queues: [],
    };
    const warnings = { items: [], page: 1, pageSize: 200, total: 0 };

    repository.getOverview = vi.fn(async () => overview);
    repository.getMetrics = vi.fn(async () => metrics);
    repository.getWarnings = vi.fn(async () => warnings);
    (
      repository as unknown as {
        getOldestCreatedAges: () => Promise<Record<string, number>>;
      }
    ).getOldestCreatedAges = vi.fn(async () => ({ email: 90 }));

    const result = await (
      repository as unknown as {
        getAlertEvaluationSnapshot: () => Promise<unknown>;
      }
    ).getAlertEvaluationSnapshot();

    expect(result).toEqual({
      overview,
      metrics,
      warnings,
      oldestCreatedAges: { email: 90 },
    });
  });

  it("builds oldest-created-age queries for created and retry jobs", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        { name: "email", ageSeconds: 90 },
        { name: "billing", ageSeconds: 45 },
      ],
    });
    const repository = new BossbenchRepository(
      { query } as never,
      "bossbench",
      [],
    );

    const result = await (
      repository as unknown as {
        getOldestCreatedAges: () => Promise<Record<string, number>>;
      }
    ).getOldestCreatedAges();

    expect(query.mock.calls[0]?.[0]).toContain("state in ('created','retry')");
    expect(query.mock.calls[0]?.[0]).toContain("group by name");
    expect(result).toEqual({ email: 90, billing: 45 });
  });

  it("evaluates windowed alert rule values without loading the full snapshot", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ value: 4 }] });
    const repository = new BossbenchRepository(
      { query } as never,
      "bossbench",
      [],
    );

    const result = await repository.getAlertEvaluationSnapshot([
      {
        id: "recent-failed",
        name: "Recent failures",
        type: "failed_count",
        queue: "email",
        windowMinutes: 15,
        threshold: 3,
      },
    ]);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("completed_on >= now() -");
    expect(query.mock.calls[0]?.[0]).toContain("name = $2");
    expect(query.mock.calls[0]?.[1]).toEqual([15, "email"]);
    expect(result.ruleValues).toEqual({ "recent-failed": 4 });
  });
});

describe("BossbenchRepository.previewQueueClean", () => {
  it("builds a preview query for completed and failed jobs older than the cutoff", async () => {
    const dateNow = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-05-29T12:00:00.000Z").getTime());
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          matchedCount: 2,
          sampleIds: ["job-1", "job-2"],
          hasMore: true,
        },
      ],
    });
    const client = { query } as never;
    const repository = new BossbenchRepository(client, "bossbench", []);

    const result = await repository.previewQueueClean("email", {
      state: "completed",
      olderThanSeconds: 7200,
      limit: 25,
    });

    expect(query.mock.calls[0]?.[0]).toContain("name = $1");
    expect(query.mock.calls[0]?.[0]).toContain("state = $2");
    expect(query.mock.calls[0]?.[0]).toContain("completed_on is not null");
    expect(query.mock.calls[0]?.[0]).toContain(
      "completed_on < $3::timestamptz",
    );
    expect(query.mock.calls[0]?.[0]).toContain("limit $4");
    expect(query.mock.calls[0]?.[0]).toContain("exists (");
    expect(query.mock.calls[0]?.[0]).toContain('from "bossbench"."job" j');
    expect(query.mock.calls[0]?.[0]).not.toContain("count(*) from doomed");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "email",
      "completed",
      "2026-05-29T10:00:00.000Z",
      25,
    ]);

    expect(result).toEqual({
      queue: "email",
      state: "completed",
      matched: 2,
      sampleIds: ["job-1", "job-2"],
      hasMore: true,
      cutoff: "2026-05-29T10:00:00.000Z",
    });
    dateNow.mockRestore();
  });
});

describe("BossbenchRepository.cleanQueue", () => {
  it("builds an atomic delete query and maps the result", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          deleted: 2,
          deletedIds: ["job-1", "job-2"],
          hasMore: true,
        },
      ],
    });
    const repository = new BossbenchRepository(
      { query } as never,
      "bossbench",
      [],
    );

    const result = await repository.cleanQueue("email", {
      state: "completed",
      cutoff: "2026-05-29T10:00:00.000Z",
      confirm: "clean completed email",
      limit: 25,
    });

    expect(query.mock.calls[0]?.[0]).toContain("with doomed as");
    expect(query.mock.calls[0]?.[0]).toContain("for update of j skip locked");
    expect(query.mock.calls[0]?.[0]).toContain("delete from");
    expect(query.mock.calls[0]?.[0]).toContain("and j.name = $1");
    expect(query.mock.calls[0]?.[0]).toContain("and j.state = $2");
    expect(query.mock.calls[0]?.[0]).toContain(
      "and j.completed_on < $3::timestamptz",
    );
    expect(query.mock.calls[0]?.[0]).toContain("name = $1");
    expect(query.mock.calls[0]?.[0]).toContain("state = $2");
    expect(query.mock.calls[0]?.[0]).toContain(
      "completed_on < $3::timestamptz",
    );
    expect(query.mock.calls[0]?.[0]).toContain(
      "order by j.completed_on asc, j.id asc",
    );
    expect(query.mock.calls[0]?.[0]).toContain("limit $4");
    expect(query.mock.calls[0]?.[0]).toContain("exists (");
    expect(query.mock.calls[0]?.[0]).toContain('from "bossbench"."job" j');
    expect(query.mock.calls[0]?.[0]).not.toContain("count(*) from doomed");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "email",
      "completed",
      "2026-05-29T10:00:00.000Z",
      25,
    ]);
    expect(result).toEqual({
      queue: "email",
      state: "completed",
      cutoff: "2026-05-29T10:00:00.000Z",
      deleted: 2,
      deletedIds: ["job-1", "job-2"],
      hasMore: true,
    });
  });
});

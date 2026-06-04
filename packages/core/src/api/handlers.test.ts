import { describe, expect, it, vi } from "vitest";
import { buildRouteTable } from "./handlers";

describe("route table /jobs parsing", () => {
  it("returns alert state", async () => {
    const alerts = {
      enabled: false,
      rules: [],
      contactPoints: [],
      violations: [],
      delivery: { enabled: false, available: false },
    };
    const getAlerts = vi.fn().mockResolvedValue(alerts);
    const route = buildRouteTable({
      ...fakeCore(vi.fn()),
      getAlerts,
    } as never).find(
      (candidate) => candidate.method === "get" && candidate.path === "/alerts",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await expect(route.handler({ params: {}, query: {} })).resolves.toEqual({
      status: 200,
      body: alerts,
    });
    expect(getAlerts).toHaveBeenCalledWith();
  });

  it("passes advanced job filters to repository.listJobs", async () => {
    const listJobs = vi.fn().mockResolvedValue({
      items: [],
      page: 3,
      pageSize: 50,
      total: 125,
    });
    const route = buildRouteTable(fakeCore(listJobs) as never).find(
      (candidate) => candidate.method === "get" && candidate.path === "/jobs",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    const result = await route.handler({
      params: {},
      query: {
        limit: "50",
        offset: "100",
        queue: "email",
        state: "failed",
        q: "daily",
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-02T00:00:00.000Z",
        sort: "created_on:desc",
        "tag.teamId": ["alpha", "beta"],
      },
    });

    expect(result.status).toBe(200);
    expect(listJobs).toHaveBeenCalledWith({
      limit: 50,
      offset: 100,
      queue: "email",
      state: "failed",
      q: "daily",
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-05-02T00:00:00.000Z",
      sort: "created_on:desc",
      tags: { teamId: ["alpha", "beta"] },
    });
  });

  it("validates queue clean preview requests", async () => {
    const previewQueueClean = vi.fn();
    const route = buildRouteTable(
      fakeCore(vi.fn(), { previewQueueClean }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" &&
        candidate.path === "/queues/:name/clean-preview",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await expect(
      route.handler({
        params: { name: "email" },
        query: {},
        body: { state: "created", olderThanSeconds: 100 },
      }),
    ).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "INVALID_FILTER" } },
    });
    expect(previewQueueClean).not.toHaveBeenCalled();
  });

  it("invokes queue clean preview repository read", async () => {
    const previewQueueClean = vi.fn().mockResolvedValue({
      queue: "email",
      state: "completed",
      matched: 3,
      sampleIds: ["job-1"],
      hasMore: false,
      cutoff: "2026-05-25T12:00:00.000Z",
    });
    const route = buildRouteTable(
      fakeCore(vi.fn(), { previewQueueClean }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" &&
        candidate.path === "/queues/:name/clean-preview",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    const result = await route.handler({
      params: { name: "email" },
      query: {},
      body: { state: "completed", olderThanSeconds: 7200, limit: 10 },
    });

    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        result: {
          queue: "email",
          state: "completed",
          matched: 3,
          sampleIds: ["job-1"],
          hasMore: false,
          cutoff: "2026-05-25T12:00:00.000Z",
        },
      },
    });
    expect(previewQueueClean).toHaveBeenCalledWith("email", {
      state: "completed",
      olderThanSeconds: 7200,
      limit: 10,
    });
  });

  it("returns a 409 when queue clean preview is disabled", async () => {
    const previewQueueClean = vi.fn();
    const ensureQueueCleanAvailable = vi.fn(() => {
      throw Object.assign(new Error("Queue clean preview is disabled"), {
        code: "QUEUE_CLEAN_DISABLED",
      });
    });
    const route = buildRouteTable(
      fakeCore(
        vi.fn(),
        { previewQueueClean },
        { ensureQueueCleanAvailable },
      ) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" &&
        candidate.path === "/queues/:name/clean-preview",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await expect(
      route.handler({
        params: { name: "email" },
        query: {},
        body: { state: "completed", olderThanSeconds: 7200 },
      }),
    ).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "QUEUE_CLEAN_DISABLED" } },
    });
    expect(previewQueueClean).not.toHaveBeenCalled();
  });

  it("passes parsed filters to repository.listFutureJobs for GET /future-jobs", async () => {
    const listFutureJobs = vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
    });
    const route = buildRouteTable(
      fakeCore(vi.fn(), { listFutureJobs }) as never,
    ).find(
      (candidate) =>
        candidate.method === "get" && candidate.path === "/future-jobs",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await route.handler({
      params: {},
      query: {
        limit: "25",
        offset: "10",
        queue: "email",
        q: "daily",
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-02T00:00:00.000Z",
        sort: "start_after:asc",
        "tag.teamId": ["alpha"],
      },
    });

    expect(listFutureJobs).toHaveBeenCalledWith({
      limit: 25,
      offset: 10,
      queue: "email",
      q: "daily",
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-05-02T00:00:00.000Z",
      sort: "start_after:asc",
      tags: { teamId: ["alpha"] },
    });
  });

  it("runs a schedule once now from schedule metadata", async () => {
    const runScheduleNow = vi.fn().mockResolvedValue({ id: "job-1" });
    const getSchedules = vi.fn().mockResolvedValue([
      {
        name: "billing",
        cron: "0 0 * * *",
        data: { nightly: true },
        opts: { singletonKey: "billing" },
        created: null,
      },
    ]);
    const route = buildRouteTable(
      fakeCore(vi.fn(), { getSchedules }, { runScheduleNow }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" &&
        candidate.path === "/schedules/:name/run-now",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    const result = await route.handler({
      params: { name: "billing" },
      query: {},
    });

    expect(result).toEqual({
      status: 200,
      body: { ok: true, result: { id: "job-1" } },
    });
    expect(runScheduleNow).toHaveBeenCalledWith(
      "billing",
      { nightly: true },
      { singletonKey: "billing" },
    );
  });

  it("returns SCHEDULE_NOT_FOUND when running a missing schedule", async () => {
    const runScheduleNow = vi.fn();
    const getSchedules = vi.fn().mockResolvedValue([]);
    const route = buildRouteTable(
      fakeCore(vi.fn(), { getSchedules }, { runScheduleNow }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" &&
        candidate.path === "/schedules/:name/run-now",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await expect(
      route.handler({ params: { name: "missing" }, query: {} }),
    ).resolves.toMatchObject({
      status: 404,
      body: { error: { code: "SCHEDULE_NOT_FOUND" } },
    });
    expect(runScheduleNow).not.toHaveBeenCalled();
  });

  it("throws INVALID_FILTER for invalid job state", async () => {
    const listJobs = vi.fn();
    const route = buildRouteTable(fakeCore(listJobs) as never).find(
      (candidate) => candidate.method === "get" && candidate.path === "/jobs",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await expect(
      route.handler({ params: {}, query: { state: "bogus" } }),
    ).rejects.toMatchObject({ code: "INVALID_FILTER" });
    expect(listJobs).not.toHaveBeenCalled();
  });

  it.each([
    [
      "state",
      { cutoff: "2026-05-25T12:00:00.000Z", confirm: "clean completed email" },
    ],
    ["cutoff", { state: "completed", confirm: "clean completed email" }],
    ["confirm", { state: "completed", cutoff: "2026-05-25T12:00:00.000Z" }],
    [
      "limit",
      {
        state: "completed",
        cutoff: "2026-05-25T12:00:00.000Z",
        confirm: "clean completed email",
        limit: 6000,
      },
    ],
  ] as const)("validates queue clean delete %s", async (_field, body) => {
    const cleanQueue = vi.fn();
    const route = buildRouteTable(
      fakeCore(
        vi.fn(),
        {},
        {
          cleanQueue,
          ensureQueueCleanDeleteAvailable: vi.fn(),
        },
      ) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/queues/:name/clean",
    );
    expect(route).toBeDefined();
    assertRoute(route);
    await expect(
      route.handler({ params: { name: "email" }, query: {}, body }),
    ).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "INVALID_FILTER" } },
    });
    expect(cleanQueue).not.toHaveBeenCalled();
  });

  it("returns INVALID_FILTER for bad confirmation", async () => {
    const cleanQueue = vi.fn();
    const route = buildRouteTable(
      fakeCore(
        vi.fn(),
        {},
        {
          cleanQueue,
          ensureQueueCleanDeleteAvailable: vi.fn(),
        },
      ) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/queues/:name/clean",
    );
    expect(route).toBeDefined();
    assertRoute(route);
    await expect(
      route.handler({
        params: { name: "email" },
        query: {},
        body: {
          state: "completed",
          cutoff: "2026-05-25T12:00:00.000Z",
          confirm: "nope",
        },
      }),
    ).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "INVALID_FILTER" } },
    });
  });

  it.each([
    ["non-object body", null],
    ["array body", []],
    [
      "invalid state",
      {
        state: "bogus",
        cutoff: "2026-05-25T12:00:00.000Z",
        confirm: "clean completed email",
      },
    ],
    [
      "invalid cutoff string",
      {
        state: "completed",
        cutoff: "not-a-date",
        confirm: "clean completed email",
      },
    ],
    [
      "cutoff newer than 3600 seconds old",
      {
        state: "completed",
        cutoff: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        confirm: "clean completed email",
      },
    ],
    [
      "non-string cutoff",
      {
        state: "completed",
        cutoff: 0,
        confirm: "clean completed email",
      },
    ],
    [
      "non-ISO cutoff",
      {
        state: "completed",
        cutoff: "06/04/2026",
        confirm: "clean completed email",
      },
    ],
    [
      "limit <= 0",
      {
        state: "completed",
        cutoff: "2026-05-25T12:00:00.000Z",
        limit: 0,
        confirm: "clean completed email",
      },
    ],
    [
      "non-integer limit",
      {
        state: "completed",
        cutoff: "2026-05-25T12:00:00.000Z",
        limit: 1.5,
        confirm: "clean completed email",
      },
    ],
    [
      "non-number limit",
      {
        state: "completed",
        cutoff: "2026-05-25T12:00:00.000Z",
        limit: "10",
        confirm: "clean completed email",
      },
    ],
  ] as const)("validates queue clean delete %s", async (_label, body) => {
    const cleanQueue = vi.fn();
    const route = buildRouteTable(
      fakeCore(
        vi.fn(),
        {},
        {
          cleanQueue,
          ensureQueueCleanDeleteAvailable: vi.fn(),
        },
      ) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/queues/:name/clean",
    );
    expect(route).toBeDefined();
    assertRoute(route);

    await expect(
      route.handler({ params: { name: "email" }, query: {}, body }),
    ).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "INVALID_FILTER" } },
    });
    expect(cleanQueue).not.toHaveBeenCalled();
  });

  it("returns a 409 when queue clean delete is disabled", async () => {
    const ensureQueueCleanDeleteAvailable = vi.fn(() => {
      throw Object.assign(new Error("Queue clean delete is disabled"), {
        code: "QUEUE_CLEAN_DELETE_DISABLED",
      });
    });
    const cleanQueue = vi.fn();
    const route = buildRouteTable(
      fakeCore(
        vi.fn(),
        { cleanQueue },
        { ensureQueueCleanDeleteAvailable },
      ) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/queues/:name/clean",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await expect(
      route.handler({
        params: { name: "email" },
        query: {},
        body: {
          state: "completed",
          cutoff: "2026-05-25T12:00:00.000Z",
          confirm: "clean completed email",
        },
      }),
    ).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "QUEUE_CLEAN_DELETE_DISABLED" } },
    });
    expect(cleanQueue).not.toHaveBeenCalled();
  });

  it("invokes core.cleanQueue for queue clean delete", async () => {
    const cleanQueue = vi.fn().mockResolvedValue({
      queue: "email",
      state: "completed",
      cutoff: "2026-05-25T12:00:00.000Z",
      deleted: 1,
      deletedIds: ["job-1"],
      hasMore: false,
    });
    const repositoryCleanQueue = vi.fn();
    const route = buildRouteTable(
      fakeCore(
        vi.fn(),
        { cleanQueue: repositoryCleanQueue },
        { ensureQueueCleanDeleteAvailable: vi.fn(), cleanQueue },
      ) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/queues/:name/clean",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    const result = await route.handler({
      params: { name: "email" },
      query: {},
      body: {
        state: "completed",
        cutoff: "2026-05-25T12:00:00.000Z",
        confirm: "clean completed email",
      },
    });

    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        result: {
          queue: "email",
          state: "completed",
          cutoff: "2026-05-25T12:00:00.000Z",
          deleted: 1,
          deletedIds: ["job-1"],
          hasMore: false,
        },
      },
    });
    expect(cleanQueue).toHaveBeenCalledWith("email", {
      state: "completed",
      cutoff: "2026-05-25T12:00:00.000Z",
      confirm: "clean completed email",
    });
    expect(repositoryCleanQueue).not.toHaveBeenCalled();
  });

  it("cleans queue after guard validation", async () => {
    const cleanQueue = vi.fn().mockResolvedValue({
      queue: "email",
      state: "completed",
      cutoff: "2026-05-25T12:00:00.000Z",
      deleted: 2,
      deletedIds: ["a", "b"],
      hasMore: false,
    });
    const ensureQueueCleanDeleteAvailable = vi.fn();
    const route = buildRouteTable(
      fakeCore(
        vi.fn(),
        {},
        { ensureQueueCleanDeleteAvailable, cleanQueue },
      ) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/queues/:name/clean",
    );
    expect(route).toBeDefined();
    assertRoute(route);
    const result = await route.handler({
      params: { name: "email" },
      query: {},
      body: {
        state: "completed",
        cutoff: "2026-05-25T12:00:00.000Z",
        confirm: "clean completed email",
        limit: 10,
      },
    });
    expect(ensureQueueCleanDeleteAvailable).toHaveBeenCalledWith();
    expect(cleanQueue).toHaveBeenCalledWith("email", {
      state: "completed",
      cutoff: "2026-05-25T12:00:00.000Z",
      confirm: "clean completed email",
      limit: 10,
    });
    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        result: {
          queue: "email",
          state: "completed",
          cutoff: "2026-05-25T12:00:00.000Z",
          deleted: 2,
          deletedIds: ["a", "b"],
          hasMore: false,
        },
      },
    });
  });

  it("bulk retry succeeds for existing jobs and reports per-job results", async () => {
    const getJob = vi.fn(async (id: string) =>
      id === "job-2" ? null : { id, name: `queue-${id}` },
    );
    const retryJob = vi.fn(async () => ({}));
    const route = buildRouteTable(
      fakeCore(vi.fn(), { getJob }, { retryJob }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/jobs/bulk/retry",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    const result = await route.handler({
      params: {},
      query: {},
      body: { ids: ["job-1", "job-2"] },
    });

    expect(result.status).toBe(200);
    expect(retryJob).toHaveBeenCalledWith("queue-job-1", "job-1");
    expect(retryJob).toHaveBeenCalledTimes(1);
    expect(result.body).toEqual({
      ok: true,
      result: {
        succeeded: [{ id: "job-1" }],
        failed: [
          {
            id: "job-2",
            code: "JOB_NOT_FOUND",
            message: "Job not found",
          },
        ],
      },
    });
  });

  it.each([
    ["READONLY_MODE", "Readonly mode"],
    ["BOSS_INSTANCE_REQUIRED", "pg-boss instance required for mutations"],
  ] as const)("bulk retry returns %s before per-item missing job results", async (code, message) => {
    const getJob = vi.fn(async () => null);
    const ensureAvailable = vi.fn(() => {
      throw Object.assign(new Error(message), { code });
    });
    const retryJob = vi.fn(async () => ({}));
    const route = buildRouteTable(
      fakeCore(vi.fn(), { getJob }, { ensureAvailable, retryJob }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/jobs/bulk/retry",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await expect(
      route.handler({
        params: {},
        query: {},
        body: { ids: ["missing-1", "missing-2"] },
      }),
    ).resolves.toMatchObject({
      status: 409,
      body: {
        error: { code, message },
      },
    });
    expect(getJob).not.toHaveBeenCalled();
    expect(retryJob).not.toHaveBeenCalled();
  });

  it("bulk actions continue after action errors", async () => {
    const getJob = vi.fn(async (id: string) => ({ id, name: `queue-${id}` }));
    const retryJob = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("boom"));
    const route = buildRouteTable(
      fakeCore(vi.fn(), { getJob }, { retryJob }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/jobs/bulk/retry",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    const result = await route.handler({
      params: {},
      query: {},
      body: { ids: ["job-1", "job-2"] },
    });

    expect(result.status).toBe(200);
    expect(retryJob).toHaveBeenCalledTimes(2);
    expect(result.body).toEqual({
      ok: true,
      result: {
        succeeded: [{ id: "job-1" }],
        failed: [
          {
            id: "job-2",
            code: "ACTION_FAILED",
            message: "Action failed",
          },
        ],
      },
    });
  });

  it("bulk action errors with codes still use a safe message", async () => {
    const getJob = vi.fn(async (id: string) => ({ id, name: `queue-${id}` }));
    const retryJob = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error("relation pgboss.job does not exist"), {
        code: "42P01",
      }),
    );
    const route = buildRouteTable(
      fakeCore(vi.fn(), { getJob }, { retryJob }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/jobs/bulk/retry",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    const result = await route.handler({
      params: {},
      query: {},
      body: { ids: ["job-1"] },
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      result: {
        succeeded: [],
        failed: [
          {
            id: "job-1",
            code: "42P01",
            message: "Action failed",
          },
        ],
      },
    });
  });

  it("enqueues a job when manual enqueue is enabled", async () => {
    const enqueueJob = vi
      .fn()
      .mockResolvedValue({ id: "job-1", enqueued: true });
    const route = buildRouteTable(
      fakeCore(vi.fn(), {}, { enqueueJob }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" &&
        candidate.path === "/queues/:name/enqueue",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    const body = {
      data: { foo: "bar" },
      options: { priority: 5, startAfter: 10 },
    };
    const result = await route.handler({
      params: { name: "email" },
      query: {},
      body,
    });

    expect(result).toEqual({
      status: 200,
      body: { ok: true, result: { id: "job-1", enqueued: true } },
    });
    expect(enqueueJob).toHaveBeenCalledWith(
      "email",
      { foo: "bar" },
      { priority: 5, startAfter: 10 },
    );
  });

  it("rejects array enqueue payloads", async () => {
    const enqueueJob = vi.fn();
    const route = buildRouteTable(
      fakeCore(vi.fn(), {}, { enqueueJob }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" &&
        candidate.path === "/queues/:name/enqueue",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await expect(
      route.handler({
        params: { name: "email" },
        query: {},
        body: { data: [] },
      }),
    ).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "INVALID_FILTER" } },
    });
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("defaults empty enqueue bodies to an empty payload", async () => {
    const enqueueJob = vi
      .fn()
      .mockResolvedValue({ id: "job-empty", enqueued: true });
    const route = buildRouteTable(
      fakeCore(vi.fn(), {}, { enqueueJob }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" &&
        candidate.path === "/queues/:name/enqueue",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    const result = await route.handler({
      params: { name: "email" },
      query: {},
      body: undefined,
    });

    expect(result.status).toBe(200);
    expect(enqueueJob).toHaveBeenCalledWith("email", {}, undefined);
  });

  it("normalizes ISO enqueue startAfter strings and rejects ambiguous dates", async () => {
    const enqueueJob = vi
      .fn()
      .mockResolvedValue({ id: "job-iso", enqueued: true });
    const route = buildRouteTable(
      fakeCore(vi.fn(), {}, { enqueueJob }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" &&
        candidate.path === "/queues/:name/enqueue",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await expect(
      route.handler({
        params: { name: "email" },
        query: {},
        body: { data: {}, options: { startAfter: "2026-05-28T10:00:00.000Z" } },
      }),
    ).resolves.toMatchObject({ status: 200 });
    expect(enqueueJob).toHaveBeenCalledWith(
      "email",
      {},
      {
        startAfter: "2026-05-28T10:00:00.000Z",
      },
    );

    await expect(
      route.handler({
        params: { name: "email" },
        query: {},
        body: { data: {}, options: { startAfter: "2026-05-28T10:00:00" } },
      }),
    ).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "INVALID_FILTER" } },
    });
  });

  it("clones a job by enqueuing its queue, data, and priority", async () => {
    const getJob = vi.fn().mockResolvedValue({
      id: "job-1",
      name: "email",
      queue: "email",
      data: { foo: 1 },
      priority: 9,
    });
    const enqueueJob = vi.fn().mockResolvedValue({ id: "job-2" });
    const route = buildRouteTable(
      fakeCore(vi.fn(), { getJob }, { enqueueJob }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/jobs/:id/clone",
    );
    expect(route).toBeDefined();
    assertRoute(route);
    const result = await route.handler({
      params: { id: "job-1" },
      query: {},
      body: undefined,
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      result: { id: "job-2", sourceJobId: "job-1", queue: "email" },
    });
    expect(enqueueJob).toHaveBeenCalledWith(
      "email",
      { foo: 1 },
      { priority: 9 },
    );
  });

  it("returns JOB_NOT_FOUND when cloning a missing job", async () => {
    const getJob = vi.fn().mockResolvedValue(null);
    const enqueueJob = vi.fn();
    const route = buildRouteTable(
      fakeCore(vi.fn(), { getJob }, { enqueueJob }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/jobs/:id/clone",
    );
    expect(route).toBeDefined();
    assertRoute(route);
    await expect(
      route.handler({ params: { id: "missing" }, query: {} }),
    ).resolves.toMatchObject({
      status: 404,
      body: { error: { code: "JOB_NOT_FOUND" } },
    });
  });

  it.each([
    ["READONLY_MODE", "Readonly mode"],
    ["BOSS_INSTANCE_REQUIRED", "Boss instance required"],
  ] as const)("bulk retry rethrows %s as a request-level error", async (code, message) => {
    const getJob = vi.fn(async () => ({ id: "job-1", name: "queue-job-1" }));
    const retryJob = vi.fn(async () => {
      throw Object.assign(new Error(message), { code });
    });
    const route = buildRouteTable(
      fakeCore(vi.fn(), { getJob }, { retryJob }) as never,
    ).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/jobs/bulk/retry",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await expect(
      route.handler({
        params: {},
        query: {},
        body: { ids: ["job-1"] },
      }),
    ).resolves.toMatchObject({
      status: 409,
      body: {
        error: {
          code,
          message,
        },
      },
    });
  });

  it("invalid bulk ids return INVALID_FILTER", async () => {
    const route = buildRouteTable(fakeCore(vi.fn()) as never).find(
      (candidate) =>
        candidate.method === "post" && candidate.path === "/jobs/bulk/retry",
    );

    expect(route).toBeDefined();
    assertRoute(route);

    await expect(
      route.handler({ params: {}, query: {}, body: { ids: [] } }),
    ).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "INVALID_FILTER" } },
    });
  });

  it.each([
    ["/jobs/bulk/retry", "retryJob", "queue-job-1"],
    ["/jobs/bulk/cancel", "cancelJob", "queue-job-1"],
    ["/jobs/bulk/delete", "deleteJob", "queue-job-1"],
  ] as const)("routes %s to %s", async (path, actionName, expectedName) => {
    const getJob = vi.fn(async () => ({ id: "job-1", name: expectedName }));
    const action = vi.fn(async () => ({}));
    const route = buildRouteTable(
      fakeCore(vi.fn(), { getJob }, { [actionName]: action }) as never,
    ).find(
      (candidate) => candidate.method === "post" && candidate.path === path,
    );

    expect(route).toBeDefined();
    assertRoute(route);

    const result = await route.handler({
      params: {},
      query: {},
      body: { ids: ["job-1"] },
    });

    expect(result.status).toBe(200);
    expect(action).toHaveBeenCalledWith(expectedName, "job-1");
  });
});

function fakeCore(
  listJobs: ReturnType<typeof vi.fn>,
  repositoryOverrides: Partial<Record<string, unknown>> = {},
  actionOverrides: Partial<Record<string, unknown>> = {},
) {
  return {
    getConfig: vi.fn(() => ({})),
    cleanQueue:
      (actionOverrides.cleanQueue as ReturnType<typeof vi.fn>) ?? vi.fn(),
    repository: {
      getOverview: vi.fn(async () => ({})),
      listQueues: vi.fn(async () => []),
      getQueue: vi.fn(async () => null),
      listJobs,
      listFutureJobs: vi.fn(async () => ({
        items: [],
        page: 1,
        pageSize: 50,
        total: 0,
      })),
      getJob: vi.fn(async () => null),
      getSchedules: vi.fn(async () => []),
      getWarnings: vi.fn(async () => ({
        items: [],
        page: 1,
        pageSize: 50,
        total: 0,
      })),
      getMetrics: vi.fn(async () => ({ buckets: [] })),
      getActivity: vi.fn(async () => ({ items: [] })),
      getTagValues: vi.fn(async () => []),
      getDeadLetter: vi.fn(async () => ({
        items: [],
        page: 1,
        pageSize: 50,
        total: 0,
      })),
      previewQueueClean: vi.fn(),
      cleanQueue: vi.fn(),
      ...repositoryOverrides,
    },
    actions: {
      ensureAvailable: vi.fn(),
      ensureQueueCleanAvailable: vi.fn(),
      ensureQueueCleanDeleteAvailable: vi.fn(),
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      resumeJob: vi.fn(),
      deleteJob: vi.fn(),
      createSchedule: vi.fn(),
      deleteSchedule: vi.fn(),
      ...actionOverrides,
    },
  };
}

function assertRoute(
  route: ReturnType<typeof buildRouteTable>[number] | undefined,
): asserts route is ReturnType<typeof buildRouteTable>[number] {
  if (!route) throw new Error("Route not found");
}

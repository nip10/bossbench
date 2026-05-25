import { describe, expect, it, vi } from "vitest";
import { buildRouteTable } from "./handlers";

describe("route table /jobs parsing", () => {
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
    repository: {
      getOverview: vi.fn(async () => ({})),
      listQueues: vi.fn(async () => []),
      getQueue: vi.fn(async () => null),
      listJobs,
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
      ...repositoryOverrides,
    },
    actions: {
      ensureAvailable: vi.fn(),
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

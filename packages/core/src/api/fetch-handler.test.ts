import { describe, expect, it, vi } from "vitest";
import type { BossbenchCore } from "../core/core";
import { createFetchHandler } from "./fetch-handler";

describe("fetch handler", () => {
  it("returns 404 for unknown routes", async () => {
    const fetch = createFetchHandler(fakeCore() as unknown as BossbenchCore);
    const res = await fetch(new Request("http://x/nope"));
    expect(res.status).toBe(404);
  });

  it("rejects invalid job state filters", async () => {
    const fetch = createFetchHandler(fakeCore() as unknown as BossbenchCore);
    const res = await fetch(new Request("http://x/api/jobs?state=bogus"));
    expect(res.status).toBe(400);
  });

  it("returns repository metrics payload unchanged", async () => {
    const payload = {
      summary: {
        totalCreated: 10,
        totalCompleted: 7,
        totalFailed: 2,
        totalRetry: 1,
        throughputPerHour: 4.2,
        errorRate: 0.2,
        avgDurationMs: 1500,
        avgWaitMs: 250,
      },
      buckets: [],
      queues: [],
    };
    const fetch = createFetchHandler(
      fakeCore({ getMetrics: async () => payload }) as unknown as BossbenchCore,
    );

    const res = await fetch(new Request("http://x/api/metrics"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(payload);
  });

  it("sanitizes database errors", async () => {
    const core = fakeCore({
      listJobs: async () => {
        throw Object.assign(new Error("relation pgboss.job does not exist"), {
          code: "42P01",
        });
      },
    });
    const fetch = createFetchHandler(core as unknown as BossbenchCore);

    const res = await fetch(new Request("http://x/api/jobs"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({
      error: { code: "DB_UNAVAILABLE", message: "Database unavailable" },
    });
  });

  it("loads jobs before invoking actions", async () => {
    const core = fakeCore({
      getJob: vi.fn(async () => ({ id: "1", name: "email" })),
    });
    const fetch = createFetchHandler(core as unknown as BossbenchCore);
    const res = await fetch(
      new Request("http://x/api/jobs/1/delete", { method: "POST" }),
    );
    expect(res.status).toBe(200);
    expect(core.actions.deleteJob).toHaveBeenCalledWith("email", "1");
  });

  it("matches bulk routes before /jobs/:id", async () => {
    const core = fakeCore({
      getJob: vi.fn(async (id: string) => ({ id, name: `queue-${id}` })),
    });
    const fetch = createFetchHandler(core as unknown as BossbenchCore);

    const res = await fetch(
      new Request("http://x/api/jobs/bulk/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ["job-1"] }),
      }),
    );

    expect(res.status).toBe(200);
    expect(core.actions.retryJob).toHaveBeenCalledWith("queue-job-1", "job-1");
  });
});

type RepositoryOverrides = Partial<{
  getJob: (id: string) => Promise<{ id: string; name: string } | null>;
  listJobs: () => Promise<unknown>;
  getMetrics: () => Promise<unknown>;
}>;

function fakeCore(overrides: RepositoryOverrides = {}) {
  return {
    options: { auth: undefined, basePath: "/", title: "Bossbench" },
    getConfig: () => ({}),
    repository: {
      getOverview: async () => ({}),
      listQueues: async () => [],
      getQueue: async () => null,
      listJobs: async () => ({ items: [], page: 1, pageSize: 50, total: 0 }),
      getJob: async () => null,
      getSchedules: async () => [],
      getWarnings: async () => ({ items: [], page: 1, pageSize: 50, total: 0 }),
      getMetrics: async () => ({ buckets: [] }),
      getActivity: async () => ({ items: [] }),
      getTagValues: async () => [],
      getDeadLetter: async () => ({
        items: [],
        page: 1,
        pageSize: 50,
        total: 0,
      }),
      ...overrides,
    },
    actions: {
      ensureAvailable: vi.fn(),
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      resumeJob: vi.fn(),
      deleteJob: vi.fn(async () => ({})),
      createSchedule: vi.fn(async () => ({})),
      deleteSchedule: vi.fn(async () => ({})),
    },
  };
}

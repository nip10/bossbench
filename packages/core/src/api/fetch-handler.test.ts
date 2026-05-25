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
});

type RepositoryOverrides = Partial<{
  getJob: (id: string) => Promise<{ id: string; name: string } | null>;
  listJobs: () => Promise<unknown>;
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
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      resumeJob: vi.fn(),
      deleteJob: vi.fn(async () => ({})),
      createSchedule: vi.fn(async () => ({})),
      deleteSchedule: vi.fn(async () => ({})),
    },
  };
}

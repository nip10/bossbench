import { describe, expect, it, vi } from "vitest";
import { createApiRoutes, jsonError } from "./api";
import { BossbenchCore } from "./core";

describe("api", () => {
  it("shapes errors", () => {
    expect(jsonError("X", "Y")).toEqual({
      error: { code: "X", message: "Y", details: undefined },
    });
  });
  it("creates routes", () => {
    expect(
      createApiRoutes({
        db: "postgres://x",
        allowUnauthenticated: true,
      } as any),
    ).toBeTruthy();
  });
  it("posts schedules through actions", async () => {
    const spy = vi.spyOn(BossbenchCore, "create").mockReturnValue({
      getConfig: () => ({}),
      requiresAuth: () => false,
      validateAuth: () => true,
      actionsEnabled: () => true,
      repository: {
        getOverview: async () => ({}),
        listQueues: async () => [],
        getQueue: async () => null,
        listJobs: async () => ({
          items: [],
          page: 1,
          pageSize: 50,
          total: 0,
        }),
        getJob: async () => null,
        getSchedules: async () => [],
        getWarnings: async () => ({
          items: [],
          page: 1,
          pageSize: 50,
          total: 0,
        }),
        getMetrics: async () => ({ buckets: [] }),
        getActivity: async () => ({ items: [] }),
        getTagValues: async () => [],
        getDeadLetter: async () => ({
          items: [],
          page: 1,
          pageSize: 50,
          total: 0,
        }),
      },
      actions: {
        createSchedule: vi.fn(async () => ({ ok: true })),
        deleteSchedule: vi.fn(),
      },
    } as any);
    const app = createApiRoutes({
      db: "postgres://x",
      allowUnauthenticated: true,
    } as any);
    const res = await app.fetch(
      new Request("http://x/schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "n", cron: "* * * * *", data: { a: 1 } }),
      }),
    );
    expect(res.status).toBe(200);
    spy.mockRestore();
  });
});

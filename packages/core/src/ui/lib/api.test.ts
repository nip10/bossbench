import { afterEach, describe, expect, it, vi } from "vitest";
import { api, buildJobsQuery } from "./api";

const bulkActionResponse = {
  ok: true,
  result: {
    succeeded: [{ id: "job-1" }],
    failed: [{ id: "job-5", code: "ACTION_FAILED", message: "Action failed" }],
  },
} as const;

function mockFetchJson(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("buildJobsQuery", () => {
  it("serializes scalar job filters", () => {
    expect(
      buildJobsQuery({
        limit: 25,
        offset: 50,
        queue: "email",
        state: "active",
        q: "invoice",
        from: "2024-01-01",
        to: "2024-01-31",
        sort: "createdOn:desc",
      }),
    ).toBe(
      "?limit=25&offset=50&queue=email&state=active&q=invoice&from=2024-01-01&to=2024-01-31&sort=createdOn%3Adesc",
    );
  });

  it("serializes repeated tag params", () => {
    expect(
      buildJobsQuery({
        tags: {
          teamId: ["alpha", "beta"],
          region: ["eu"],
        },
      }),
    ).toBe("?tag.teamId=alpha&tag.teamId=beta&tag.region=eu");
  });

  it("ignores empty tag arrays and returns empty string when nothing serializes", () => {
    expect(buildJobsQuery({ tags: { teamId: [], region: [] } })).toBe("");
    expect(buildJobsQuery()).toBe("");
  });

  it("does not serialize zero limit or offset values", () => {
    expect(buildJobsQuery({ limit: 0, offset: 0 })).toBe("");
  });
});

describe("bulk job actions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("bulkRetryJobs posts ids to the retry endpoint", async () => {
    const fetchMock = mockFetchJson(bulkActionResponse);

    await expect(api.bulkRetryJobs(["job-1", "job-2"])).resolves.toEqual(
      bulkActionResponse,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/jobs/bulk/retry"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ids: ["job-1", "job-2"] }),
      }),
    );
  });

  it("bulkCancelJobs posts ids to the cancel endpoint", async () => {
    const fetchMock = mockFetchJson(bulkActionResponse);

    await expect(api.bulkCancelJobs(["job-3"])).resolves.toEqual(
      bulkActionResponse,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/jobs/bulk/cancel"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ids: ["job-3"] }),
      }),
    );
  });

  it("bulkDeleteJobs posts ids to the delete endpoint", async () => {
    const fetchMock = mockFetchJson(bulkActionResponse);

    await expect(api.bulkDeleteJobs(["job-4", "job-5"])).resolves.toEqual(
      bulkActionResponse,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/jobs/bulk/delete"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ids: ["job-4", "job-5"] }),
      }),
    );
  });
});

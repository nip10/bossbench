import { describe, expect, it } from "vitest";
import { normalizeJobsFilters, queryKeys } from "./hooks";

describe("normalizeJobsFilters", () => {
  it("keeps search, pagination, and non-empty tag filters", () => {
    expect(
      normalizeJobsFilters({
        q: "invoice",
        queue: "email",
        state: "active",
        from: "2024-01-01",
        to: "2024-01-31",
        sort: "created_on:desc",
        limit: 25,
        offset: 50,
        tags: {
          teamId: ["alpha", ""],
          region: [],
          owner: ["ops"],
        },
      }),
    ).toEqual({
      q: "invoice",
      queue: "email",
      state: "active",
      from: "2024-01-01",
      to: "2024-01-31",
      sort: "created_on:desc",
      limit: 25,
      offset: 50,
      tags: {
        teamId: ["alpha"],
        owner: ["ops"],
      },
    });
  });

  it("returns undefined when no filters are provided", () => {
    expect(normalizeJobsFilters()).toBeUndefined();
  });
});

describe("queryKeys.jobs", () => {
  it("includes the normalized jobs filters in the query key", () => {
    expect(
      queryKeys.jobs({
        offset: 25,
        from: "2024-01-01",
        tags: { teamId: ["alpha"], region: [] },
      }),
    ).toEqual([
      "jobs",
      {
        from: "2024-01-01",
        offset: 25,
        tags: { teamId: ["alpha"] },
      },
    ]);
  });
});

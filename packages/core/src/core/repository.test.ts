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

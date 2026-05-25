import { describe, expect, it } from "vitest";
import { createDemoJobs, DEMO_QUEUES } from "./seed";

describe("demo seed fixtures", () => {
  it("covers pg-boss queues and states used by the dashboard", () => {
    const jobs = createDemoJobs();

    expect(DEMO_QUEUES).toEqual(["email", "reports", "billing"]);
    expect(new Set(jobs.map((job) => job.state))).toEqual(
      new Set(["created", "completed", "failed", "retry", "active"]),
    );
    expect(jobs.every((job) => job.data.demo === "true")).toBe(true);
  });
});

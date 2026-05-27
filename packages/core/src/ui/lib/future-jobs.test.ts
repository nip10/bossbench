import { describe, expect, it } from "vitest";
import {
  futureJobsDefaultSort,
  futureJobsEmptyDescription,
  futureJobsSubtitle,
} from "./future-jobs";

describe("future jobs page helpers", () => {
  it("defaults to earliest start_after first", () => {
    expect(futureJobsDefaultSort()).toBe("start_after:asc");
  });

  it("summarizes total and visible range", () => {
    expect(futureJobsSubtitle(12, 1, 10)).toBe(
      "12 concrete jobs scheduled for later • 1-10",
    );
    expect(futureJobsSubtitle(0, 0, 0)).toBe(
      "0 concrete jobs scheduled for later",
    );
  });

  it("explains empty states without mixing schedules into future jobs", () => {
    expect(futureJobsEmptyDescription(false)).toContain(
      "Schedules are managed separately",
    );
    expect(futureJobsEmptyDescription(true)).toContain("Relax the filters");
  });
});

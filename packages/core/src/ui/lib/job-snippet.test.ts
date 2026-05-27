import { describe, expect, it } from "vitest";
import { failureSnippetForJobSummary } from "./job-snippet";

describe("failureSnippetForJobSummary", () => {
  it("hides snippets for non-failed jobs", () => {
    expect(
      failureSnippetForJobSummary({
        id: "1",
        name: "n",
        queue: "q",
        state: "completed",
        failureSnippet: "boom",
        createdOn: null,
        startAfter: null,
        startedOn: null,
        completedOn: null,
        priority: null,
        data: null,
        output: null,
      }),
    ).toBe("—");
  });

  it("truncates failed snippets", () => {
    expect(
      failureSnippetForJobSummary({
        id: "1",
        name: "n",
        queue: "q",
        state: "failed",
        failureSnippet: "x".repeat(100),
        createdOn: null,
        startAfter: null,
        startedOn: null,
        completedOn: null,
        priority: null,
        data: null,
        output: null,
      }),
    ).toMatch(/…$/);
  });
});

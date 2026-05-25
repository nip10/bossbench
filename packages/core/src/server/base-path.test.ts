import { describe, expect, it } from "vitest";
import { resolveBasePath } from "./base-path";

describe("base path", () => {
  it("normalizes configured paths", () => {
    expect(resolveBasePath("/jobs", "/jobs/queues/email")).toBe("/jobs/");
  });

  it("detects mounted paths for known client routes", () => {
    expect(resolveBasePath(undefined, "/jobs/queues/email")).toBe("/jobs/");
    expect(resolveBasePath(undefined, "/jobs/jobs/123")).toBe("/jobs/");
    expect(resolveBasePath(undefined, "/jobs/settings")).toBe("/jobs/");
  });

  it("supports root-mounted client routes", () => {
    expect(resolveBasePath(undefined, "/jobs")).toBe("/");
    expect(resolveBasePath(undefined, "/queues/email")).toBe("/");
    expect(resolveBasePath(undefined, "/jobs/123")).toBe("/");
  });

  it("does not confuse dynamic values with route segments", () => {
    expect(resolveBasePath(undefined, "/dash/queues/jobs")).toBe("/dash/");
  });
});

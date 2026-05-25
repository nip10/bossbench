import { describe, expect, it } from "vitest";
import { bossbench } from "./index";

describe("nestjs adapter", () => {
  it("is a function", () => {
    expect(typeof bossbench).toBe("function");
  });
});

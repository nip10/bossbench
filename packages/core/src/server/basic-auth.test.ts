import { describe, expect, it } from "vitest";
import { checkBasicAuth } from "./basic-auth";

describe("basic auth", () => {
  it("verifies credentials", () => {
    expect(
      checkBasicAuth(
        `Basic ${Buffer.from("a:b").toString("base64")}`,
        "a",
        "b",
      ),
    ).toBe(true);
    expect(checkBasicAuth(undefined, "a", "b")).toBe(false);
  });
});

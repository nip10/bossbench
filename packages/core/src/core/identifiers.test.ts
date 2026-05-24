import { describe, expect, it } from "vitest";
import { assertSafeIdentifier, quoteQualifiedIdentifier } from "./identifiers";

describe("identifiers", () => {
  it("quotes safe identifiers", () => {
    expect(quoteQualifiedIdentifier("pgboss", "job")).toBe('"pgboss"."job"');
  });
  it("rejects unsafe names", () => {
    expect(() => assertSafeIdentifier("bad-name")).toThrow();
  });
});

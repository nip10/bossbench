import { describe, expect, it } from "vitest";
import { normalizeOptions } from "./options";

describe("normalizeOptions", () => {
  it("defaults schema and read-only flags for explicit unauthenticated mode", () => {
    const o = normalizeOptions({
      db: "postgres://example",
      allowUnauthenticated: true,
    });
    expect(o.schema).toBe("pgboss");
    expect(o.title).toBe("Bossbench");
    expect(o.readonly).toBe(true);
    expect(o.tags).toEqual([]);
    expect(o.allowManualEnqueue).toBe(false);
    expect(o.allowQueueClean).toBe(false);
  });
  it("enables mutations by default when auth is configured", () => {
    const o = normalizeOptions({
      db: "postgres://example",
      auth: { username: "admin", password: "secret" },
    });
    expect(o.readonly).toBe(false);
  });
  it("requires db or boss", () => {
    expect(() => normalizeOptions({})).toThrow(
      "Bossbench requires a db connection or a pg-boss instance",
    );
  });
  it("requires non-empty auth unless unauthenticated mode is explicit", () => {
    expect(() => normalizeOptions({ db: "postgres://example" })).toThrow(
      "Bossbench requires non-empty auth or allowUnauthenticated: true",
    );
    expect(() =>
      normalizeOptions({
        db: "postgres://example",
        auth: { username: "", password: "" },
      }),
    ).toThrow(
      "Bossbench requires non-empty auth or allowUnauthenticated: true",
    );
  });
});

import { describe, expect, it } from "vitest";
import { BossbenchCore } from "./core";

describe("BossbenchCore", () => {
  it("normalizes and exposes auth/actions flags", () => {
    const core = BossbenchCore.create({
      db: "postgres://example",
      auth: { username: "u", password: "p" },
    });
    expect(core.getConfig().schema).toBe("pgboss");
    expect(core.requiresAuth()).toBe(true);
    expect(core.validateAuth("u", "p")).toBe(true);
    expect(core.actionsEnabled()).toBe(false);
    expect(core.getConfig().allowManualEnqueue).toBe(false);
  });
});

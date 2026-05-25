import { describe, expect, it } from "vitest";
import { bossbench } from "./index";

describe("next adapter", () => {
  it("serves config via route handlers", async () => {
    const routes = bossbench({
      db: "postgres://example",
      allowUnauthenticated: true,
    });
    expect(
      (await routes.GET(new Request("http://localhost/api/config"))).status,
    ).toBe(200);
  });

  it("requires auth when configured", async () => {
    const routes = bossbench({
      db: "postgres://example",
      auth: { username: "admin", password: "secret" },
    });
    expect(
      (await routes.GET(new Request("http://localhost/api/config"))).status,
    ).toBe(401);
  });
});

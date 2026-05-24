import { describe, expect, it } from "vitest";
import { bossbench } from "./index";

describe("hono adapter", () => {
  it("serves API config in explicit unauthenticated mode", async () => {
    const app = bossbench({
      db: "postgres://example",
      allowUnauthenticated: true,
    });

    const res = await app.request("/api/config");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("Bossbench");
  });

  it("requires basic auth when credentials are configured", async () => {
    const app = bossbench({
      db: "postgres://example",
      auth: { username: "admin", password: "secret" },
    });

    const unauthorized = await app.request("/api/config");
    const authorized = await app.request("/api/config", {
      headers: {
        authorization: `Basic ${Buffer.from("admin:secret").toString("base64")}`,
      },
    });

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
  });
});

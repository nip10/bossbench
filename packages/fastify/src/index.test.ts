import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { bossbench } from "./index";

describe("fastify adapter", () => {
  it("serves config and html", async () => {
    const app = Fastify();
    await app.register(
      bossbench({
        db: "postgres://example",
        basePath: "/jobs",
        allowUnauthenticated: true,
      }),
      { prefix: "/jobs" },
    );
    const config = await app.inject({ method: "GET", url: "/jobs/api/config" });
    const html = await app.inject({ method: "GET", url: "/jobs/not-a-route" });
    expect(config.statusCode).toBe(200);
    expect(config.json().title).toBe("Bossbench");
    expect(html.payload).toContain('<base href="/jobs/">');
  });

  it("requires auth when configured", async () => {
    const app = Fastify();
    await app.register(
      bossbench({
        db: "postgres://example",
        basePath: "/jobs",
        auth: { username: "admin", password: "secret" },
      }),
      { prefix: "/jobs" },
    );
    expect(
      (await app.inject({ method: "GET", url: "/jobs/api/config" })).statusCode,
    ).toBe(401);
  });
});

import { createApp, toWebHandler } from "h3";
import { describe, expect, it } from "vitest";
import { bossbench } from "./index";

describe("h3 adapter", () => {
  it("serves html and config when mounted under a base path", async () => {
    const handler = bossbench({
      db: "postgres://example",
      basePath: "/jobs",
      allowUnauthenticated: true,
    });

    const fetch = toWebHandler(
      createApp().use("/jobs", handler).use("/jobs/**", handler),
    );
    const html = await fetch(new Request("http://localhost/jobs"));
    const config = await fetch(new Request("http://localhost/jobs/api/config"));

    expect(html.status).toBe(200);
    expect(await html.text()).toContain('<base href="/jobs/"');
    expect(config.status).toBe(200);
    expect(await config.json()).toMatchObject({ title: "Bossbench" });
  });

  it("requires auth when credentials are configured", async () => {
    const handler = bossbench({
      db: "postgres://example",
      auth: { username: "admin", password: "secret" },
    });

    const fetch = toWebHandler(
      createApp().use("/jobs", handler).use("/jobs/**", handler),
    );
    const unauthorized = await fetch(new Request("http://localhost/jobs"));

    expect(unauthorized.status).toBe(401);
  });

  it("preserves JSON request bodies for mounted mutation routes", async () => {
    const handler = bossbench({
      db: "postgres://example",
      basePath: "/jobs",
      allowUnauthenticated: true,
    });
    const fetch = toWebHandler(
      createApp().use("/jobs", handler).use("/jobs/**", handler),
    );

    const response = await fetch(
      new Request("http://localhost/jobs/api/jobs/bulk/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ["job-1"] }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "READONLY_MODE" },
    });
  });
});

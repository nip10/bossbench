import { describe, expect, it } from "vitest";
import { bossbench } from "./index";

describe("tanstack-start adapter", () => {
  it("serves html when mounted", async () => {
    const routes = bossbench({
      db: "postgres://example",
      basePath: "/jobs",
      allowUnauthenticated: true,
    });
    const response = await routes.GET({
      request: new Request("http://localhost/jobs"),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain('<base href="/jobs/"');
  });

  it("serves config via request objects", async () => {
    const routes = bossbench({
      db: "postgres://example",
      basePath: "/jobs",
      allowUnauthenticated: true,
    });
    const response = await routes.GET({
      request: new Request("http://localhost/jobs/api/config"),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ title: "Bossbench" });
  });

  it("requires auth when configured", async () => {
    const routes = bossbench({
      db: "postgres://example",
      basePath: "/jobs",
      auth: { username: "admin", password: "secret" },
    });
    const response = await routes.GET({
      request: new Request("http://localhost/jobs/api/config"),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
  });
});

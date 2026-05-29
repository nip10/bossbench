import { createApp, toWebHandler } from "h3";
import { describe, expect, it } from "vitest";
import { bossbench } from "./index.js";

describe("nuxt adapter", () => {
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
});

import { readdirSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { UI_DIST_PATH } from "@bossbench/core";
import express from "express";
import { describe, expect, it } from "vitest";
import { bossbench } from "./index";

// Content-hashed by the Vite build, so read the real filename instead of hardcoding it.
const [bundledCssAsset] = readdirSync(join(UI_DIST_PATH, "assets")).filter(
  (name) => name.endsWith(".css"),
);

describe("express adapter", () => {
  it("serves API config in explicit unauthenticated mode", async () => {
    const app = express();
    app.use(
      "/jobs",
      bossbench({ db: "postgres://example", allowUnauthenticated: true }),
    );

    const res = await request(app, "/jobs/api/config");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("Bossbench");
  });

  it("requires basic auth when credentials are configured", async () => {
    const app = express();
    app.use(
      "/jobs",
      bossbench({
        db: "postgres://example",
        auth: { username: "admin", password: "secret" },
      }),
    );

    const unauthorized = await request(app, "/jobs/api/config");
    const authorized = await request(app, "/jobs/api/config", {
      authorization: `Basic ${Buffer.from("admin:secret").toString("base64")}`,
    });

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
  });

  it("injects base path into SPA HTML for mounted dashboards", async () => {
    const app = express();
    app.use(
      "/jobs",
      bossbench({ db: "postgres://example", allowUnauthenticated: true }),
    );

    const res = await request(app, "/jobs/queues/email");
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('<base href="/jobs/">');
  });

  it("serves bundled UI assets by nested path", async () => {
    const app = express();
    app.use(
      "/jobs",
      bossbench({ db: "postgres://example", allowUnauthenticated: true }),
    );

    const res = await request(app, `/jobs/assets/${bundledCssAsset}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
  });

  it("404s an unknown asset instead of falling through to the SPA shell", async () => {
    const app = express();
    app.use(
      "/jobs",
      bossbench({ db: "postgres://example", allowUnauthenticated: true }),
    );

    const res = await request(app, "/jobs/assets/does-not-exist.js");

    expect(res.status).toBe(404);
  });
});

async function request(
  app: ReturnType<typeof express>,
  path: string,
  headers?: Record<string, string>,
) {
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const { port } = server.address() as AddressInfo;
    return await fetch(
      `http://127.0.0.1:${port}${path}`,
      headers ? { headers } : undefined,
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

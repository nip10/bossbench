import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { describe, expect, it } from "vitest";
import { bossbench } from "./index";

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

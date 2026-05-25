import { describe, expect, it } from "vitest";
import { bossbench } from "./index";

describe("elysia adapter", () => {
  it("serves config and html", async () => {
    const handler = bossbench({
      db: "postgres://example",
      allowUnauthenticated: true,
    });
    expect(
      (await handler(new Request("http://localhost/api/config"))).status,
    ).toBe(200);
    expect(
      await (
        await handler(new Request("http://localhost/jobs/queues/email"))
      ).text(),
    ).toContain('<base href="/jobs/">');
  });

  it("requires auth when configured", async () => {
    const handler = bossbench({
      db: "postgres://example",
      auth: { username: "admin", password: "secret" },
    });
    expect(
      (await handler(new Request("http://localhost/api/config"))).status,
    ).toBe(401);
    expect(
      (
        await handler(
          new Request("http://localhost/api/config", {
            headers: {
              authorization: `Basic ${Buffer.from("admin:secret").toString("base64")}`,
            },
          }),
        )
      ).status,
    ).toBe(200);
  });
});

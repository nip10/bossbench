import { describe, expect, it } from "vitest";
import { mountBossbench } from "./index";

describe("adonis adapter", () => {
  it("registers bare and wildcard routes", () => {
    const router = createRouter();

    mountBossbench(router as never, "/jobs", {
      db: "postgres://example",
      allowUnauthenticated: true,
    });

    expect(router.getCalls).toEqual([["/jobs", expect.any(Function)]]);
    expect(router.routeCalls).toEqual([
      [
        "/jobs/*",
        ["GET", "POST", "PUT", "PATCH", "DELETE"],
        expect.any(Function),
      ],
    ]);
  });

  it("converts a route context into a fetch request", async () => {
    const router = createRouter();
    mountBossbench(router as never, "/jobs", {
      db: "postgres://example",
      allowUnauthenticated: true,
    });

    const handler = router.routeCalls[0]?.[2] as (
      ctx: FakeContext,
    ) => Promise<unknown>;
    const ctx = createContext({
      method: "GET",
      url: "/jobs/api/config?x=1",
      headers: { accept: "application/json" },
    });

    await handler(ctx as never);

    expect(ctx.response.statusCode).toBe(200);
    expect(ctx.response.headers["content-type"]).toContain("application/json");
    expect(ctx.response.body).toContain('"title":"Bossbench"');
  });

  it("serves dashboard html on bare route", async () => {
    const router = createRouter();
    mountBossbench(router as never, "/jobs", {
      db: "postgres://example",
      allowUnauthenticated: true,
    });

    const handler = router.getCalls[0]?.[1] as (
      ctx: FakeContext,
    ) => Promise<unknown>;
    const ctx = createContext({ method: "GET", url: "/jobs" });

    await handler(ctx as never);

    expect(ctx.response.statusCode).toBe(200);
    expect(ctx.response.headers["content-type"]).toContain("text/html");
    expect(ctx.response.body).toContain('<base href="/jobs/">');
  });

  it("requires auth on bare route when configured", async () => {
    const router = createRouter();
    mountBossbench(router as never, "/jobs", {
      db: "postgres://example",
      auth: { username: "admin", password: "secret" },
    });

    const handler = router.getCalls[0]?.[1] as (
      ctx: FakeContext,
    ) => Promise<unknown>;
    const ctx = createContext({ method: "GET", url: "/jobs" });

    await handler(ctx as never);

    expect(ctx.response.statusCode).toBe(401);
    expect(ctx.response.headers["www-authenticate"]).toContain("Basic");
  });
});

function createRouter() {
  return {
    getCalls: [] as Array<[string, unknown]>,
    routeCalls: [] as Array<[string, string[], unknown]>,
    get(path: string, handler: unknown) {
      this.getCalls.push([path, handler]);
    },
    route(path: string, methods: string[], handler: unknown) {
      this.routeCalls.push([path, methods, handler]);
    },
  };
}

type FakeContext = ReturnType<typeof createContext>;

function createContext({
  method,
  url,
  headers = {},
  body,
}: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}) {
  return {
    request: {
      method: () => method,
      header: (name: string) => headers[name.toLowerCase()],
      body: () => body,
      completeUrl: () => `http://127.0.0.1${url}`,
      qs: () => ({}),
    },
    response: {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: "" as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      header(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
        return this;
      },
      type(value: string) {
        this.headers["content-type"] = value;
        return this;
      },
      send(value: unknown) {
        this.body = typeof value === "string" ? value : JSON.stringify(value);
        return this;
      },
      json(value: unknown) {
        this.headers["content-type"] = "application/json; charset=utf-8";
        this.body = JSON.stringify(value);
        return this;
      },
      end() {
        return this;
      },
    },
  };
}

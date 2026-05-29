import type { BossbenchOptions } from "@bossbench/core";
import { BossbenchCore, buildBossbenchApp } from "@bossbench/core";

export interface AdonisRouterLike {
  get(path: string, handler: AdonisHandler): void;
  route(path: string, methods: string[], handler: AdonisHandler): void;
}

export interface AdonisContextLike {
  request: {
    method(): string;
    completeUrl(): string;
    header(name: string): string | undefined;
    body?(): unknown;
    qs?(): Record<string, string | string[] | undefined>;
  };
  response: {
    status(code: number): AdonisContextLike["response"];
    header(name: string, value: string): AdonisContextLike["response"];
    type(value: string): AdonisContextLike["response"];
    send(value: unknown): unknown;
    json?(value: unknown): unknown;
  };
}

export type AdonisHandler = (
  ctx: AdonisContextLike,
) => Promise<unknown> | unknown;

export function mountBossbench(
  router: AdonisRouterLike,
  mountPath: string,
  options: BossbenchOptions,
) {
  const core = BossbenchCore.create({ ...options, basePath: mountPath });
  const app = buildBossbenchApp(core);

  router.get(mountPath, async (ctx) => {
    const response = await app.fetch(toRequest(ctx, mountPath));
    return writeResponse(ctx, response);
  });

  router.route(
    `${mountPath}/*`,
    ["GET", "POST", "PUT", "PATCH", "DELETE"],
    async (ctx) => {
      const response = await app.fetch(toRequest(ctx, mountPath));
      return writeResponse(ctx, response);
    },
  );
}

function toRequest(ctx: AdonisContextLike, mountPath: string): Request {
  const url = new URL(ctx.request.completeUrl());
  const pathname = stripPrefix(url.pathname, mountPath);
  url.pathname = pathname ?? url.pathname;
  const init: RequestInit = { method: ctx.request.method() };
  const headers = new Headers();
  const auth = ctx.request.header("authorization");
  if (auth) headers.set("authorization", auth);
  const accept = ctx.request.header("accept");
  if (accept) headers.set("accept", accept);
  init.headers = headers;
  const body = ctx.request.body?.();
  if (body !== undefined && init.method !== "GET" && init.method !== "HEAD") {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new Request(url, init);
}

function writeResponse(ctx: AdonisContextLike, response: Response) {
  ctx.response.status(response.status);
  response.headers.forEach((value, key) => {
    ctx.response.header(key, value);
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (
    contentType.startsWith("text/") ||
    contentType.includes("json") ||
    contentType.includes("javascript") ||
    contentType.includes("xml")
  ) {
    return response.text().then((text) => ctx.response.send(text));
  }
  return response
    .arrayBuffer()
    .then((body) => ctx.response.send(new Uint8Array(body)));
}

function stripPrefix(pathname: string, mountPath: string) {
  if (pathname === mountPath) return "/";
  if (pathname.startsWith(`${mountPath}/`))
    return pathname.slice(mountPath.length);
  return pathname;
}

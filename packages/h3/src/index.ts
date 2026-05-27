import type { BossbenchOptions } from "@bossbench/core";
import { BossbenchCore, buildBossbenchApp } from "@bossbench/core";
import { defineEventHandler, toWebRequest } from "h3";

export function bossbench(options: BossbenchOptions) {
  const core = BossbenchCore.create(options);
  const app = buildBossbenchApp(core);
  const basePath = normalizeBasePath(core.options.basePath);

  return defineEventHandler(async (event) => {
    const request = toWebRequest(event);
    return app.fetch(stripMountPath(request, basePath));
  });
}

function normalizeBasePath(basePath: string) {
  if (basePath === "/") return "/";
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

function stripMountPath(request: Request, basePath: string) {
  if (basePath === "/") return request;

  const url = new URL(request.url);
  if (url.pathname === basePath) {
    url.pathname = "/";
  } else if (url.pathname.startsWith(`${basePath}/`)) {
    url.pathname = url.pathname.slice(basePath.length) || "/";
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: request.headers,
    signal: request.signal,
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  return new Request(url, init);
}

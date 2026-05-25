import type { BossbenchOptions } from "@bossbench/core";
import {
  BossbenchCore,
  checkBasicAuth,
  createFetchHandler,
  renderIndexHtml,
  resolveBasePath,
  serveStaticAsset,
} from "@bossbench/core";

export function bossbench(options: BossbenchOptions) {
  const core = BossbenchCore.create(options);
  const apiHandler = createFetchHandler(core, { basePath: "/api" });
  const mountBase = normalizeBasePath(core.options.basePath);

  return async (request: Request) => {
    const url = new URL(request.url);
    const auth = core.options.auth;
    if (
      core.requiresAuth() &&
      !checkBasicAuth(
        request.headers.get("authorization") ?? undefined,
        auth?.username ?? "",
        auth?.password ?? "",
      )
    ) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="Bossbench"' },
        },
      );
    }

    const pathname = stripMount(url.pathname, mountBase);
    if (pathname.startsWith("/api"))
      return apiHandler(await rewriteRequest(request, pathname));
    if (pathname.startsWith("/assets/")) {
      const asset = serveStaticAsset(pathname.slice("/assets/".length));
      if (asset.status === 404 || !asset.body)
        return new Response(null, { status: 404 });
      return new Response(new Uint8Array(asset.body), {
        status: 200,
        headers: { "content-type": asset.contentType },
      });
    }

    const basePath = resolveBasePath(core.options.basePath, url.pathname);
    const html = renderIndexHtml(basePath, core.options.title);
    return new Response(html.body, {
      status: 200,
      headers: { "content-type": html.contentType },
    });
  };
}

function normalizeBasePath(basePath: string) {
  return basePath === "/" ? "" : basePath.replace(/\/$/, "");
}

function stripMount(pathname: string, mountBase: string) {
  return mountBase && pathname.startsWith(mountBase)
    ? pathname.slice(mountBase.length) || "/"
    : pathname;
}

async function rewriteRequest(request: Request, pathname: string) {
  const url = new URL(request.url);
  url.pathname = pathname;
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }
  return new Request(url, init);
}

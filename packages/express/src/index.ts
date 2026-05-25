import { timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import type { BossbenchOptions } from "@bossbench/core";
import { BossbenchCore, createApiRoutes, UI_DIST_PATH } from "@bossbench/core";
import express, {
  type Router as ExpressRouter,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
  Router,
} from "express";

interface FetchApp {
  fetch(
    request: globalThis.Request,
  ): globalThis.Response | Promise<globalThis.Response>;
}

export function bossbench(options: BossbenchOptions): ExpressRouter {
  const core = BossbenchCore.create(options);
  const r = Router();
  if (core.requiresAuth()) r.use(auth(core));
  const api = createApiRoutes(options);
  r.use(
    "/api",
    express.json({ type: ["application/json", "application/*+json"] }),
    bridge(api),
  );
  r.get("/assets/*", serveAssets());
  r.get("/config", (_req, res) => res.json(core.getConfig()));
  r.get("*", (req, res) =>
    res.type("html").send(shell(req.baseUrl || core.options.basePath)),
  );
  return r;
}

function bridge(app: FetchApp): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = `${req.protocol}://${req.get("host")}${req.url}`;
      const headers = headersFromExpress(req);
      const init: RequestInit = { method: req.method, headers };
      if (
        req.method !== "GET" &&
        req.method !== "HEAD" &&
        req.body != null &&
        Object.keys(req.body).length
      )
        init.body = JSON.stringify(req.body);
      const request = new Request(url, init);
      const response = await app.fetch(request);
      res.status(response.status);
      response.headers.forEach((v: string, k: string) => {
        res.setHeader(k, v);
      });
      const body = Buffer.from(await response.arrayBuffer());
      res.send(body);
    } catch (e) {
      next(e);
    }
  };
}
function auth(core: BossbenchCore): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = parseBasicAuth(req.headers.authorization);
    const authOptions = core.options.auth;
    if (
      !authOptions ||
      !parsed ||
      !safeCredentialsEqual(
        parsed.username,
        parsed.password,
        authOptions.username,
        authOptions.password,
      )
    )
      return res
        .status(401)
        .setHeader("WWW-Authenticate", 'Basic realm="Bossbench"')
        .json({
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
    next();
  };
}
function shell(basePath = "/") {
  const path = `${UI_DIST_PATH}/index.html`;
  const html = existsSync(path)
    ? readFileSync(path, "utf8")
    : '<!doctype html><html><body><div id="root"></div></body></html>';
  return html.replace(
    "<head>",
    `<head>\n    <base href="${withTrailingSlash(basePath)}">`,
  );
}

function withTrailingSlash(path: string) {
  return path.endsWith("/") ? path : `${path}/`;
}
function serveAssets(): RequestHandler {
  return (req: Request, res: Response) => {
    const file = safeAssetPath(String(req.params[0] ?? ""));
    if (!file) return res.status(404).end();
    const path = join(UI_DIST_PATH, "assets", file);
    if (existsSync(path)) return res.sendFile(path);
    return res.status(404).end();
  };
}
function headersFromExpress(req: Request) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  return headers;
}
function safeAssetPath(file: string) {
  const normalized = normalize(file);
  return normalized.startsWith("..") || normalized.startsWith("/")
    ? undefined
    : normalized;
}
function parseBasicAuth(header?: string) {
  if (!header?.startsWith("Basic ")) return undefined;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const splitAt = decoded.indexOf(":");
    if (splitAt < 0) return undefined;
    return {
      username: decoded.slice(0, splitAt),
      password: decoded.slice(splitAt + 1),
    };
  } catch {
    return undefined;
  }
}
function safeCredentialsEqual(
  username: string,
  password: string,
  expectedUsername: string,
  expectedPassword: string,
) {
  return (
    safeEqual(username, expectedUsername) &&
    safeEqual(password, expectedPassword)
  );
}
function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

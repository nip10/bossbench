import { timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import type { BossbenchOptions } from "@bossbench/core";
import { BossbenchCore, createApiRoutes, UI_DIST_PATH } from "@bossbench/core";
import { Hono } from "hono";

export function bossbench(options: BossbenchOptions) {
  const core = BossbenchCore.create(options);
  const app = new Hono();
  if (core.requiresAuth())
    app.use("*", async (c, next) => {
      const parsed = parseBasicAuth(c.req.header("authorization"));
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
        return c.text("Unauthorized", 401, {
          "WWW-Authenticate": 'Basic realm="Bossbench"',
        });
      return next();
    });
  app.route("/api", createApiRoutes(options));
  app.get("/config", (c) => c.json(core.getConfig()));
  app.get("/assets/*", (c) => {
    const file = safeAssetPath(c.req.path);
    if (!file) return c.text("Not found", 404);
    const path = join(UI_DIST_PATH, "assets", file);
    if (!existsSync(path)) return c.text("Not found", 404);
    return c.body(readFileSync(path), 200, {
      "Content-Type": contentType(path),
    });
  });
  app.get("*", (c) => c.html(indexHtml()));
  return app;
}

function indexHtml() {
  const path = `${UI_DIST_PATH}/index.html`;
  return existsSync(path)
    ? readFileSync(path, "utf8")
    : '<!doctype html><html><body><div id="root"></div></body></html>';
}
function safeAssetPath(path: string) {
  const file = path.split("/assets/")[1] ?? "";
  const normalized = normalize(file);
  return normalized.startsWith("..") || normalized.startsWith("/")
    ? undefined
    : normalized;
}
function contentType(path: string) {
  return path.endsWith(".js")
    ? "application/javascript"
    : path.endsWith(".css")
      ? "text/css"
      : "application/octet-stream";
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

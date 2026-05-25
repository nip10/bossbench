import { Hono } from "hono";
import { cors } from "hono/cors";
import { createApiRoutes } from "../api/router";
import type { BossbenchCore } from "../core/core";
import { resolveBasePath } from "./base-path";
import { checkBasicAuth } from "./basic-auth";
import { renderIndexHtml, serveStaticAsset } from "./static-assets";

export function buildBossbenchApp(core: BossbenchCore): Hono {
  const app = new Hono();

  app.use("/api/*", cors());

  if (core.requiresAuth()) {
    app.use("*", async (c, next) => {
      const auth = core.options.auth;
      if (
        !auth ||
        !checkBasicAuth(
          c.req.header("authorization"),
          auth.username,
          auth.password,
        )
      ) {
        return c.text("Unauthorized", 401, {
          "WWW-Authenticate": 'Basic realm="Bossbench"',
        });
      }
      return next();
    });
  }

  app.route("/api", createApiRoutes(core));
  app.get("/config", (c) => c.json(core.getConfig()));
  app.get("/assets/*", (c) => {
    const asset = serveStaticAsset(c.req.path.split("/assets/")[1] ?? "");
    if (asset.status === 404 || !asset.body) return c.text("Not found", 404);
    return c.body(new Uint8Array(asset.body), 200, {
      "Content-Type": asset.contentType,
    });
  });
  app.get("*", (c) => {
    const basePath = resolveBasePath(core.options.basePath, c.req.path);
    const html = renderIndexHtml(basePath, core.options.title ?? "Bossbench");
    return c.html(html.body);
  });

  return app;
}

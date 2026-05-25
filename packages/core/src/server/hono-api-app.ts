import { Hono } from "hono";
import { cors } from "hono/cors";
import { createApiRoutes } from "../api/router";
import type { BossbenchCore } from "../core/core";
import { checkBasicAuth } from "./basic-auth";

export function buildBossbenchApiApp(core: BossbenchCore): Hono {
  const app = new Hono();

  app.use("/api/*", cors());
  app.use("/config", cors());

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
  return app;
}

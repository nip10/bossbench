import type { BossbenchOptions } from "@bossbench/core";
import {
  BossbenchCore,
  checkBasicAuth,
  createFetchHandler,
  renderIndexHtml,
  resolveBasePath,
  serveStaticAsset,
} from "@bossbench/core";
import express, {
  type Router as ExpressRouter,
  type RequestHandler,
  Router,
} from "express";

export function bossbench(options: BossbenchOptions): ExpressRouter {
  const core = BossbenchCore.create(options);
  const router = Router();

  if (core.requiresAuth()) {
    router.use(auth(core));
  }

  router.use(
    "/api",
    express.json({ type: ["application/json", "application/*+json"] }),
    bridge(createFetchHandler(core, { basePath: "/" })),
  );
  router.get("/assets/*", serveAssets());
  router.get("/config", (_req, res) => res.json(core.getConfig()));
  router.get("*", (req, res) => {
    const basePath = resolveBasePath(
      core.options.basePath,
      req.originalUrl.split("?")[0] ?? req.path,
    );
    const html = renderIndexHtml(basePath, core.options.title ?? "Bossbench");
    res.type(html.contentType).send(html.body);
  });

  return router;
}

function bridge(
  fetcher: (request: globalThis.Request) => Promise<globalThis.Response>,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const url = `${req.protocol}://${req.get("host")}${req.url}`;
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") headers.set(key, value);
      }

      const init: RequestInit = {
        method: req.method,
        headers,
      };
      if (req.method !== "GET" && req.method !== "HEAD") {
        init.body = JSON.stringify(req.body ?? undefined);
      }

      const response = await fetcher(new Request(url, init));
      res.status(response.status);
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      res.send(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  };
}

function auth(core: BossbenchCore): RequestHandler {
  return (req, res, next) => {
    const auth = core.options.auth;
    if (
      !auth ||
      !checkBasicAuth(req.headers.authorization, auth.username, auth.password)
    ) {
      res
        .status(401)
        .setHeader("WWW-Authenticate", 'Basic realm="Bossbench"')
        .json({
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      return;
    }
    next();
  };
}

function serveAssets(): RequestHandler {
  return (req, res) => {
    const assetName = String(req.params[0] ?? "");
    const asset = serveStaticAsset(assetName);
    if (asset.status === 404 || !asset.body) {
      res.status(404).end();
      return;
    }
    res.type(asset.contentType).send(asset.body);
  };
}

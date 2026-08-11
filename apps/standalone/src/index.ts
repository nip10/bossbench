import { BossbenchCore, buildBossbenchApp } from "@bossbench/core";
import { Hono } from "hono";
import { Pool } from "pg";
import { PgBoss } from "pg-boss";
import {
  readStandaloneConfig,
  type StandaloneConfig,
  type StandaloneDatabaseConfig,
  shouldRedirectRoot,
  shouldStartBoss,
} from "./config";

declare const Bun: {
  serve(options: {
    host: string;
    port: number;
    fetch: (request: Request) => Response | Promise<Response>;
  }): void;
};
declare const process: { env: Record<string, string | undefined> };

const config = readStandaloneConfig(process.env);

async function buildDatabaseApp(
  db: StandaloneDatabaseConfig,
  allDatabases: StandaloneDatabaseConfig[],
) {
  const pool = new Pool({ connectionString: db.databaseUrl });
  const boss = shouldStartBoss(config)
    ? new PgBoss({ connectionString: db.databaseUrl, schema: db.schema })
    : undefined;
  if (boss) await boss.start();

  const core = BossbenchCore.create({
    db: pool,
    ...(boss ? { boss } : {}),
    schema: db.schema,
    basePath: config.basePath,
    title: config.title,
    readonly: config.readonly,
    ...(config.auth ? { auth: config.auth } : { allowUnauthenticated: true }),
    ...(allDatabases.length > 1
      ? {
          databases: allDatabases.map(({ id, name }) => ({ id, name })),
          activeDatabaseId: db.id,
        }
      : {}),
  });

  return buildBossbenchApp(core);
}

/**
 * `buildBossbenchApp` registers routes relative to its own root ("/config",
 * "/api/*", ...); Hono's `.route(basePath, app)` normally handles stripping
 * that prefix at registration time. Multi-database mode picks the target
 * app per request instead, so the prefix has to be stripped by hand before
 * delegating to that app's `fetch`.
 */
function stripBasePath(request: Request, basePath: string): Request {
  if (basePath === "/") return request;
  const url = new URL(request.url);
  const prefix = basePath.slice(0, -1);
  if (url.pathname === prefix) url.pathname = "/";
  else if (url.pathname.startsWith(basePath))
    url.pathname = `/${url.pathname.slice(basePath.length)}`;
  else return request;
  return new Request(url, request);
}

async function buildApp(config: StandaloneConfig) {
  const app = new Hono();
  if (shouldRedirectRoot(config))
    app.get("/", (c) => c.redirect(config.basePath));
  app.get("/health", (c) => c.json({ ok: true }));

  if (config.databases.length === 1) {
    const [db] = config.databases as [StandaloneDatabaseConfig];
    app.route(config.basePath, await buildDatabaseApp(db, config.databases));
    return app;
  }

  const entries = await Promise.all(
    config.databases.map(async (db) => ({
      id: db.id,
      app: await buildDatabaseApp(db, config.databases),
    })),
  );
  const appsById = new Map(entries.map((entry) => [entry.id, entry.app]));
  const defaultId = entries[0]?.id;
  if (!defaultId) throw new Error("No databases configured");

  app.all(`${config.basePath}*`, (c) => {
    const requestedId = c.req.query("db");
    const targetId =
      requestedId && appsById.has(requestedId) ? requestedId : defaultId;
    const targetApp = appsById.get(targetId);
    if (!targetApp) return c.text("Not found", 404);
    return targetApp.fetch(stripBasePath(c.req.raw, config.basePath));
  });

  return app;
}

const app = await buildApp(config);

Bun.serve({ host: config.host, port: config.port, fetch: app.fetch });

console.log(
  `Bossbench standalone running at http://${config.host}:${config.port}${config.basePath}`,
);
if (config.databases.length > 1) {
  console.log(
    `Databases: ${config.databases.map((db) => `${db.name} (db=${db.id})`).join(", ")}`,
  );
}

import { BossbenchCore, buildBossbenchApp } from "@bossbench/core";
import { Hono } from "hono";
import { Pool } from "pg";
import { PgBoss } from "pg-boss";
import {
  readStandaloneConfig,
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
const pool = new Pool({ connectionString: config.databaseUrl });
const boss = shouldStartBoss(config)
  ? new PgBoss({ connectionString: config.databaseUrl, schema: config.schema })
  : undefined;

if (boss) await boss.start();

const app = new Hono();
if (shouldRedirectRoot(config))
  app.get("/", (c) => c.redirect(config.basePath));
app.get("/health", (c) => c.json({ ok: true }));
const core = BossbenchCore.create({
  db: pool,
  ...(boss ? { boss } : {}),
  schema: config.schema,
  basePath: config.basePath,
  title: config.title,
  readonly: config.readonly,
  ...(config.auth ? { auth: config.auth } : { allowUnauthenticated: true }),
});

app.route(config.basePath, buildBossbenchApp(core));

Bun.serve({ host: config.host, port: config.port, fetch: app.fetch });

console.log(
  `Bossbench standalone running at http://${config.host}:${config.port}${config.basePath}`,
);

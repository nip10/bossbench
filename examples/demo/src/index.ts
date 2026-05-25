import { bossbench } from "@bossbench/hono";
import { Hono } from "hono";
import { Pool } from "pg";
import { PgBoss } from "pg-boss";
import { seedDemoData } from "./seed";

const port = Number(process.env.PORT ?? 3000);
const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/bossbench";
const username = process.env.BOSSBENCH_USER ?? "admin";
const password = process.env.BOSSBENCH_PASS ?? "change-me";
const schema = process.env.PGBOSS_SCHEMA ?? "pgboss";

const pool = new Pool({ connectionString });
const boss = new PgBoss({ connectionString, schema });
await boss.start();

if (process.env.DEMO_SEED !== "false") {
  await seedDemoData({ boss, pool, schema });
}

const app = new Hono();

app.get("/", (c) => c.redirect("/jobs"));
app.get("/health", (c) => c.json({ ok: true }));
app.route(
  "/jobs",
  bossbench({
    boss,
    db: pool,
    schema,
    basePath: "/jobs",
    tags: ["teamId"],
    auth: { username, password },
  }),
);

Bun.serve({ port, fetch: app.fetch });

console.log(`Bossbench demo running at http://localhost:${port}/jobs`);
console.log(`Username: ${username}`);
console.log(`Password: ${password}`);

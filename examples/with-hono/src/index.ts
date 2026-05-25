import { bossbench } from "@bossbench/hono";
import { Hono } from "hono";
import { Pool } from "pg";
import { PgBoss } from "pg-boss";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:54329/bossbench";
const schema = process.env.PGBOSS_SCHEMA ?? "pgboss";
const boss = new PgBoss({ connectionString, schema });
const db = new Pool({ connectionString });

await boss.start();

const app = new Hono();
app.get("/", (c) => c.json({ ok: true }));
app.route(
  "/jobs",
  bossbench({
    boss,
    db,
    schema,
    basePath: "/jobs",
    tags: ["teamId"],
    auth: {
      username: process.env.BOSSBENCH_USER ?? "admin",
      password: process.env.BOSSBENCH_PASS ?? "change-me",
    },
  }),
);

Bun.serve({ port: Number(process.env.PORT ?? 3000), fetch: app.fetch });

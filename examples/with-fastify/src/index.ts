import { bossbench } from "@bossbench/fastify";
import Fastify from "fastify";
import { Pool } from "pg";
import { PgBoss } from "pg-boss";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:54329/bossbench";
const schema = process.env.PGBOSS_SCHEMA ?? "pgboss";
const boss = new PgBoss({ connectionString, schema });
const db = new Pool({ connectionString });
await boss.start();
const app = Fastify();
app.get("/", async () => ({ ok: true }));
await app.register(
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
  { prefix: "/jobs" },
);
await app.listen({ port: Number(process.env.PORT ?? 3000) });

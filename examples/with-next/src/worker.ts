import { PgBoss } from "pg-boss";

const boss = new PgBoss({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:54329/bossbench",
  schema: process.env.PGBOSS_SCHEMA ?? "pgboss",
});
await boss.start();

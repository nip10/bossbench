import { bossbench } from "@bossbench/next";
import { PgBoss } from "pg-boss";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:54329/bossbench";
const schema = process.env.PGBOSS_SCHEMA ?? "pgboss";
const boss = new PgBoss({ connectionString, schema });
await boss.start();

export const { DELETE, GET, PATCH, POST, PUT } = bossbench({
  boss,
  db: connectionString,
  schema,
  basePath: "/jobs",
  auth: {
    username: process.env.BOSSBENCH_USER ?? "admin",
    password: process.env.BOSSBENCH_PASS ?? "change-me",
  },
});

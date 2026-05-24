import { bossbench } from "@bossbench/express";
import express from "express";
import PgBoss from "pg-boss";

const app = express();
const boss = process.env.DATABASE_URL
  ? new PgBoss({ connectionString: process.env.DATABASE_URL, schema: "pgboss" })
  : undefined;
if (boss) await boss.start();
app.use(
  "/jobs",
  bossbench({ boss, db: process.env.DATABASE_URL, auth: requiredAuth() }),
);
export default app;

function requiredAuth() {
  if (!process.env.BOSSBENCH_USER || !process.env.BOSSBENCH_PASS)
    throw new Error(
      "Set BOSSBENCH_USER and BOSSBENCH_PASS for the Bossbench example",
    );
  return {
    username: process.env.BOSSBENCH_USER,
    password: process.env.BOSSBENCH_PASS,
  };
}

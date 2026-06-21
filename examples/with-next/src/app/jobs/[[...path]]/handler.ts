import { bossbench } from "@bossbench/next";
import { PgBoss } from "pg-boss";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:54329/bossbench";
const schema = process.env.PGBOSS_SCHEMA ?? "pgboss";
const boss = new PgBoss({ connectionString, schema });
let bossStarted: Promise<void> | null = null;

const handlers = bossbench({
  boss,
  db: connectionString,
  schema,
  basePath: "/jobs",
  auth: {
    username: process.env.BOSSBENCH_USER ?? "admin",
    password: process.env.BOSSBENCH_PASS ?? "change-me",
  },
});

async function ensureBossStarted() {
  bossStarted ??= boss.start().then(
    () => undefined,
    (error) => {
      bossStarted = null;
      throw error;
    },
  );
  await bossStarted;
}

function withStartedBoss(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      await ensureBossStarted();
    }
    return handler(request);
  };
}

export const GET = handlers.GET;
export const POST = withStartedBoss(handlers.POST);
export const PUT = withStartedBoss(handlers.PUT);
export const PATCH = withStartedBoss(handlers.PATCH);
export const DELETE = withStartedBoss(handlers.DELETE);

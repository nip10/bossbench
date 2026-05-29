import { bossbench } from "@bossbench/tanstack-start";

declare const process: {
  env: Record<string, string | undefined>;
};

export const bossbenchHandlers = bossbench({
  db: process.env.DATABASE_URL ?? "postgres://example",
  basePath: "/jobs",
  allowUnauthenticated: true,
});

export const { DELETE, GET, PATCH, POST, PUT } = bossbenchHandlers;

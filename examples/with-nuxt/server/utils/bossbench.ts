import { bossbench } from "@bossbench/nuxt";

export const bossbenchHandler = bossbench({
  db: process.env.DATABASE_URL ?? "postgres://example",
  basePath: "/jobs",
  allowUnauthenticated: true,
});

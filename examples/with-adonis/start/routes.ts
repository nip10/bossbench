import { mountBossbench } from "@bossbench/adonis";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://example";

export function registerRoutes(router: {
  get: (...args: unknown[]) => void;
  route: (...args: unknown[]) => void;
}) {
  mountBossbench(router as never, "/jobs", {
    db: databaseUrl,
    allowUnauthenticated: true,
  });
}

import { type Client, Pool, type PoolClient } from "pg";
export type DbLike = string | Pool | Client | PoolClient;
const pools = new Map<string, Pool>();
export async function withDb<T>(
  db: DbLike,
  fn: (client: Pool | Client | PoolClient) => Promise<T>,
): Promise<T> {
  if (typeof db === "string") {
    let pool = pools.get(db);
    if (!pool) {
      pool = new Pool({ connectionString: db });
      pools.set(db, pool);
    }
    return fn(pool);
  }
  return fn(db);
}
export function clearDbPools() {
  for (const pool of pools.values()) void pool.end().catch(() => undefined);
  pools.clear();
}

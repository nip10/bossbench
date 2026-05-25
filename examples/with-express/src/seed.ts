import type { Pool } from "pg";
import type { PgBoss } from "pg-boss";

export async function seedDemoData({
  boss,
  pool,
  schema,
}: {
  boss: PgBoss;
  pool: Pool;
  schema: string;
}) {
  await boss.createQueue("email").catch(() => undefined);
  await pool.query(`delete from ${schema}.job where data ->> 'demo' = 'true'`);
}

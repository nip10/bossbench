import type { Pool } from "pg";
import type { PgBoss } from "pg-boss";

export const DEMO_QUEUES = ["email", "reports", "billing"] as const;

export interface DemoJobFixture {
  name: string;
  state: "created" | "retry" | "active" | "completed" | "cancelled" | "failed";
  priority: number;
  data: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedOffsetMinutes?: number;
  completedOffsetMinutes?: number;
}

export function createDemoJobs(): DemoJobFixture[] {
  return [
    {
      name: "email",
      state: "created",
      priority: 5,
      data: { demo: "true", teamId: "growth", subject: "Welcome email" },
    },
    {
      name: "email",
      state: "completed",
      priority: 2,
      data: { demo: "true", teamId: "growth", subject: "Receipt" },
      output: { delivered: true },
      startedOffsetMinutes: 42,
      completedOffsetMinutes: 40,
    },
    {
      name: "reports",
      state: "failed",
      priority: 1,
      data: { demo: "true", teamId: "ops", report: "daily-summary" },
      output: { error: "Warehouse timeout" },
      startedOffsetMinutes: 22,
      completedOffsetMinutes: 21,
    },
    {
      name: "billing",
      state: "retry",
      priority: 10,
      data: { demo: "true", teamId: "finance", invoiceId: "inv_demo_001" },
      output: { retryReason: "Payment provider rate limited" },
      startedOffsetMinutes: 8,
    },
    {
      name: "billing",
      state: "active",
      priority: 8,
      data: { demo: "true", teamId: "finance", invoiceId: "inv_demo_002" },
      startedOffsetMinutes: 2,
    },
  ];
}

export async function seedDemoData({
  boss,
  pool,
  schema = "pgboss",
}: {
  boss: PgBoss;
  pool: Pool;
  schema?: string;
}) {
  for (const queue of DEMO_QUEUES) {
    await boss.createQueue(queue).catch(() => undefined);
  }

  await boss.schedule("reports", "*/5 * * * *", { demo: "true", kind: "summary" }).catch(() => undefined);

  await pool.query(`delete from ${schema}.job where data ->> 'demo' = 'true'`);
  await pool.query(`delete from ${schema}.warning where data ->> 'demo' = 'true'`);

  for (const job of createDemoJobs()) {
    await pool.query(
      `insert into ${schema}.job (name, state, priority, data, output, started_on, completed_on, created_on)
       values ($1, $2, $3, $4::jsonb, $5::jsonb,
        case when $6::int is null then null else now() - ($6::int * interval '1 minute') end,
        case when $7::int is null then null else now() - ($7::int * interval '1 minute') end,
        now() - interval '1 hour')`,
      [
        job.name,
        job.state,
        job.priority,
        JSON.stringify(job.data),
        JSON.stringify(job.output ?? null),
        job.startedOffsetMinutes ?? null,
        job.completedOffsetMinutes ?? null,
      ],
    );
  }

  await pool.query(
    `insert into ${schema}.warning (type, message, data) values ($1, $2, $3::jsonb)`,
    ["demo-warning", "This is sample warning data for the Bossbench demo", JSON.stringify({ demo: "true" })],
  );
}

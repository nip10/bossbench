import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BossbenchRepository } from "./repository";

const connectionString = process.env.BOSSBENCH_DATABASE_URL;
const describeIntegration = connectionString ? describe : describe.skip;

describeIntegration("BossbenchRepository pg-boss integration", () => {
  if (!connectionString) throw new Error("BOSSBENCH_DATABASE_URL is required");

  const schema = `bossbench_it_${randomUUID().replaceAll("-", "_")}`;
  const emailJobId = randomUUID();
  const reportJobId = randomUUID();
  let pool: Pool;
  let boss: PgBoss;
  let repository: BossbenchRepository;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    boss = new PgBoss({ connectionString, schema });
    await boss.start();
    await boss.createQueue("email");
    await boss.createQueue("reports");
    await boss.schedule("email", "* * * * *", { scheduled: true });

    await pool.query(
      `insert into ${schema}.job (id, name, state, priority, data, output, created_on, completed_on)
       values
         ($1, 'email', 'created', 5, $2::jsonb, null, now() - interval '2 hours', null),
         ($3, 'reports', 'failed', 1, $4::jsonb, $5::jsonb, now() - interval '1 hour', now())`,
      [
        emailJobId,
        JSON.stringify({ teamId: "alpha", subject: "hello" }),
        reportJobId,
        JSON.stringify({ teamId: "beta", report: "daily" }),
        JSON.stringify({ error: "boom" }),
      ],
    );

    await pool.query(
      `insert into ${schema}.warning (type, message, data) values ($1, $2, $3::jsonb)`,
      ["test-warning", "integration warning", JSON.stringify({ ok: true })],
    );

    repository = new BossbenchRepository(pool, schema, ["teamId"]);
  }, 30_000);

  afterAll(async () => {
    await boss?.stop();
    await pool?.query(`drop schema if exists ${schema} cascade`);
    await pool?.end();
  }, 30_000);

  it("reads queues and overview from a real pg-boss schema", async () => {
    const queues = await repository.listQueues();
    const overview = await repository.getOverview();

    expect(queues.map((queue) => queue.name).sort()).toEqual([
      "email",
      "reports",
    ]);
    expect(overview.totals.created).toBeGreaterThanOrEqual(1);
    expect(overview.totals.failed).toBeGreaterThanOrEqual(1);
    expect(overview.warnings).toBe(1);
  });

  it("filters jobs by state, queue, text, and configured tags", async () => {
    const failed = await repository.listJobs({ state: "failed", limit: 10 });
    const tagged = await repository.listJobs({
      tags: { teamId: ["alpha"] },
      limit: 10,
    });
    const searched = await repository.listJobs({ q: "daily", limit: 10 });

    expect(failed.items).toHaveLength(1);
    expect(failed.items[0]?.id).toBe(reportJobId);
    expect(tagged.items).toHaveLength(1);
    expect(tagged.items[0]?.id).toBe(emailJobId);
    expect(searched.items).toHaveLength(1);
    expect(searched.items[0]?.name).toBe("reports");
  });

  it("reads job details, schedules, warnings, metrics, activity, and tag values", async () => {
    const job = await repository.getJob(emailJobId);
    const schedules = await repository.getSchedules();
    const warnings = await repository.getWarnings();
    const metrics = await repository.getMetrics();
    const activity = await repository.getActivity();
    const tagValues = await repository.getTagValues("teamId");

    expect(job?.name).toBe("email");
    expect(job?.createdOn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(schedules.some((schedule) => schedule.name === "email")).toBe(true);
    expect(warnings.items[0]?.name).toBe("test-warning");
    expect(metrics.buckets.length).toBeGreaterThan(0);
    expect(activity.items.length).toBeGreaterThan(0);
    expect(tagValues.sort()).toEqual(["alpha", "beta"]);
  });

  it("rejects unconfigured tag fields", async () => {
    await expect(repository.getTagValues("unknownTag")).rejects.toMatchObject({
      code: "INVALID_FILTER",
    });
  });
});

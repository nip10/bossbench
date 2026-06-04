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
  const completedJobId = randomUUID();
  const completedJobId2 = randomUUID();
  const pendingJobId = randomUUID();
  const activeJobId = randomUUID();
  const cancelledJobId = randomUUID();
  const legacyJobId = randomUUID();
  const retryJobId = randomUUID();
  let pool: Pool;
  let boss: PgBoss;
  let repository: BossbenchRepository;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    boss = new PgBoss({ connectionString, schema });
    await boss.start();
    await boss.createQueue("email");
    await boss.createQueue("pending");
    await boss.createQueue("reports");
    await boss.createQueue("legacy");
    await boss.createQueue("active");
    await boss.createQueue("cancelled");
    await boss.schedule("email", "* * * * *", { scheduled: true });

    await pool.query(
      `insert into ${schema}.job (id, name, state, priority, data, output, created_on, started_on, completed_on)
        values
          ($1, 'email', 'created', 5, $2::jsonb, null, now() - interval '2 hours', now() - interval '90 minutes', null),
          ($3, 'reports', 'failed', 1, $4::jsonb, $5::jsonb, now() - interval '2 hours', now() - interval '100 minutes', now() - interval '90 minutes'),
          ($6, 'email', 'completed', 1, $7::jsonb, $8::jsonb, now() - interval '6 hours', now() - interval '5 hours', now() - interval '4 hours'),
          ($9, 'email', 'completed', 1, $10::jsonb, $11::jsonb, now() - interval '5 hours', now() - interval '4 hours', now() - interval '3 hours'),
          ($12, 'pending', 'created', 1, $13::jsonb, null, now() - interval '30 minutes', null, null),
          ($14, 'active', 'active', 1, $15::jsonb, null, now() - interval '20 minutes', now() - interval '10 minutes', null),
          ($16, 'cancelled', 'cancelled', 1, $17::jsonb, null, now() - interval '18 minutes', null, null),
          ($18, 'legacy', 'completed', 1, $19::jsonb, $20::jsonb, now() - interval '200 hours', now() - interval '199 hours', now() - interval '1 hour'),
          ($21, 'reports', 'retry', 1, $22::jsonb, null, now() - interval '15 minutes', now() - interval '10 minutes', null)`,
      [
        emailJobId,
        JSON.stringify({ teamId: "alpha", subject: "hello" }),
        reportJobId,
        JSON.stringify({ teamId: "beta", report: "daily" }),
        JSON.stringify({ error: "boom" }),
        completedJobId,
        JSON.stringify({ teamId: "delta", report: "old-completed" }),
        JSON.stringify({ deadLetter: true, retryCount: 2 }),
        completedJobId2,
        JSON.stringify({ teamId: "delta", report: "older-completed" }),
        JSON.stringify({ deadLetter: true, retryCount: 4 }),
        pendingJobId,
        JSON.stringify({ teamId: "gamma", report: "pending" }),
        activeJobId,
        JSON.stringify({ teamId: "gamma", report: "active" }),
        cancelledJobId,
        JSON.stringify({ teamId: "gamma", report: "cancelled" }),
        legacyJobId,
        JSON.stringify({ teamId: "delta", report: "legacy" }),
        JSON.stringify({ archived: true }),
        retryJobId,
        JSON.stringify({ teamId: "beta", report: "retry" }),
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
      "active",
      "cancelled",
      "email",
      "legacy",
      "pending",
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
    expect(metrics.summary.totalCreated).toBeGreaterThanOrEqual(2);
    expect(metrics.summary.totalCompleted).toBeGreaterThanOrEqual(1);
    expect(metrics.summary.totalFailed).toBeGreaterThanOrEqual(1);
    expect(metrics.summary.totalRetry).toBeGreaterThanOrEqual(1);
    expect(metrics.summary.errorRate).toBeGreaterThanOrEqual(0);
    expect(metrics.summary.avgDurationMs).toBeGreaterThan(0);
    expect(metrics.summary.avgWaitMs).toBeGreaterThan(0);
    expect(metrics.buckets.length).toBeGreaterThan(0);
    const bucketWithAverages = metrics.buckets.find(
      (bucket) => bucket.avgDurationMs !== null && bucket.avgWaitMs !== null,
    );
    expect(bucketWithAverages).toBeDefined();
    expect(bucketWithAverages?.avgDurationMs).toBeGreaterThan(0);
    expect(bucketWithAverages?.avgWaitMs).toBeGreaterThan(0);
    expect(metrics.buckets.some((bucket) => bucket.retry > 0)).toBe(true);
    expect(metrics.queues.map((queue) => queue.name).sort()).toEqual([
      "active",
      "cancelled",
      "email",
      "legacy",
      "pending",
      "reports",
    ]);
    const pending = metrics.queues.find((queue) => queue.name === "pending");
    expect(pending?.avgDurationMs).toBeNull();
    expect(pending?.avgWaitMs).toBeNull();
    expect(pending?.lastActivity).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const legacy = metrics.queues.find((queue) => queue.name === "legacy");
    expect(legacy?.created).toBe(0);
    expect(legacy?.completed).toBeGreaterThanOrEqual(1);
    expect(legacy?.failed).toBe(0);
    expect(legacy?.lastActivity).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(activity.items.length).toBeGreaterThan(0);
    expect(tagValues.sort()).toEqual(["alpha", "beta", "delta", "gamma"]);
  });

  it("deletes completed and failed jobs in batches while preserving other states", async () => {
    const firstPass = await repository.cleanQueue("email", {
      state: "completed",
      cutoff: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      confirm: "clean completed email",
      limit: 1,
    });

    expect(firstPass.deleted).toBe(1);
    expect(firstPass.deletedIds).toHaveLength(1);
    expect(firstPass.hasMore).toBe(true);

    const secondPass = await repository.cleanQueue("email", {
      state: "completed",
      cutoff: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      confirm: "clean completed email",
      limit: 10,
    });

    expect(secondPass.deleted).toBe(1);
    expect(secondPass.hasMore).toBe(false);

    const failedPass = await repository.cleanQueue("reports", {
      state: "failed",
      cutoff: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      confirm: "clean failed reports",
      limit: 10,
    });

    expect(failedPass.deleted).toBe(1);
    expect(failedPass.deletedIds).toEqual([reportJobId]);

    const remaining = await pool.query(
      `select id, state from ${schema}.job where id = any($1::uuid[]) order by state asc, id asc`,
      [
        [
          emailJobId,
          reportJobId,
          pendingJobId,
          activeJobId,
          cancelledJobId,
          legacyJobId,
          retryJobId,
        ],
      ],
    );

    expect(remaining.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: emailJobId, state: "created" }),
        expect.objectContaining({ id: pendingJobId, state: "created" }),
        expect.objectContaining({ id: activeJobId, state: "active" }),
        expect.objectContaining({ id: cancelledJobId, state: "cancelled" }),
        expect.objectContaining({ id: legacyJobId, state: "completed" }),
        expect.objectContaining({ id: retryJobId, state: "retry" }),
      ]),
    );
    expect(remaining.rows.some((row) => row.id === reportJobId)).toBe(false);
    expect(remaining.rows.some((row) => row.id === completedJobId)).toBe(false);
    expect(remaining.rows.some((row) => row.id === completedJobId2)).toBe(
      false,
    );
  });

  it("rejects unconfigured tag fields", async () => {
    await expect(repository.getTagValues("unknownTag")).rejects.toMatchObject({
      code: "INVALID_FILTER",
    });
  });
});

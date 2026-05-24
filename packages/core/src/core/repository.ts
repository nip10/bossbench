import type { Client, Pool, PoolClient } from "pg";
import { withDb } from "./db";
import { quoteIdentifier, quoteQualifiedIdentifier } from "./identifiers";
import type {
  ActivityPoint,
  BossbenchJobState,
  JobDetail,
  JobSummary,
  MetricPoint,
  OverviewStats,
  PaginatedResponse,
  QueryFilters,
  QueueDetail,
  QueueInfo,
  ScheduleInfo,
  WarningInfo,
} from "./types";

type DbClient = Pool | Client | PoolClient;

export class BossbenchRepository {
  constructor(
    private readonly db: string | Pool | Client | undefined,
    private readonly schema: string,
    private readonly tagFields: string[] = [],
  ) {}
  private requireDb() {
    if (!this.db)
      throw error("DB_UNAVAILABLE", "Database connection required for reads");
    return this.db;
  }
  private q(table: string) {
    return quoteQualifiedIdentifier(this.schema, table);
  }

  async getOverview(): Promise<OverviewStats> {
    const queues = await this.listQueues();
    const totals = {
      created: 0,
      retry: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      failed: 0,
    } as Record<BossbenchJobState, number>;
    for (const q of queues)
      for (const s of Object.keys(totals) as BossbenchJobState[])
        totals[s] += q[s] ?? 0;
    const warnings = await this.countOptional("warning");
    return {
      totals,
      queues,
      deadLetter: await this.countState("failed"),
      warnings,
    };
  }

  async listQueues(): Promise<QueueInfo[]> {
    return this.withClient(async (client) =>
      this.safeQuery(
        client,
        `select name, count(*)::int as total, count(*) filter (where state='created')::int as created, count(*) filter (where state='retry')::int as retry, count(*) filter (where state='active')::int as active, count(*) filter (where state='completed')::int as completed, count(*) filter (where state='cancelled')::int as cancelled, count(*) filter (where state='failed')::int as failed from ${this.q("job")} group by name order by name`,
      ),
    );
  }
  async getQueue(name: string): Promise<QueueDetail | null> {
    const rows = await this.withClient((c) =>
      this.safeQuery<any>(
        c,
        `select name, count(*)::int as total, count(*) filter (where state='created')::int as created, count(*) filter (where state='retry')::int as retry, count(*) filter (where state='active')::int as active, count(*) filter (where state='completed')::int as completed, count(*) filter (where state='cancelled')::int as cancelled, count(*) filter (where state='failed')::int as failed from ${this.q("job")} where name=$1 group by name`,
        [name],
      ),
    );
    const queue = rows[0];
    if (!queue) return null;
    const recentJobs = await this.listJobs({ queue: name, limit: 10 }).then(
      (r) => r.items,
    );
    return { ...(queue as QueueInfo), recentJobs } as QueueDetail;
  }
  async listJobs(
    filters: QueryFilters = {},
  ): Promise<PaginatedResponse<JobSummary>> {
    const limit = clamp(filters.limit ?? 50, 1, 200);
    const offset = Math.max(0, filters.offset ?? 0);
    const where: string[] = [];
    const args: unknown[] = [];
    if (filters.queue) {
      args.push(filters.queue);
      where.push(`name = $${args.length}`);
    }
    if (filters.state) {
      args.push(filters.state);
      where.push(`state = $${args.length}`);
    }
    if (filters.q) {
      args.push(`%${filters.q}%`);
      const i = args.length;
      where.push(
        `(name ILIKE $${i} OR state::text ILIKE $${i} OR data::text ILIKE $${i})`,
      );
    }
    if (filters.from) {
      args.push(filters.from);
      where.push(`created_on >= $${args.length}::timestamptz`);
    }
    if (filters.to) {
      args.push(filters.to);
      where.push(`created_on <= $${args.length}::timestamptz`);
    }
    if (filters.tags) {
      for (const [field, values] of Object.entries(filters.tags)) {
        if (!values.length) continue;
        const safeField = this.tagField(field);
        const placeholders: string[] = [];
        for (const value of values) {
          args.push(value);
          placeholders.push(`$${args.length}`);
        }
        where.push(`(data ->> '${safeField}' in (${placeholders.join(", ")}))`);
      }
    }
    const sql = `select id::text, name, name as queue, state::text, created_on, started_on, completed_on, priority, data, output from ${this.q("job")}${where.length ? ` where ${where.join(" and ")}` : ""} order by ${sortClause(filters.sort)} limit $${args.push(limit)} offset $${args.push(offset)}`;
    const items = await this.withClient((c) =>
      this.safeQuery<any>(c, sql, args),
    );
    const total = await this.countJobs(where, args.slice(0, -2));
    return {
      items: items.map(rowToJobSummary),
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      total,
    };
  }
  async getJob(id: string): Promise<JobDetail | null> {
    const rows = await this.withClient((c) =>
      this.safeQuery<any>(c, `select * from ${this.q("job")} where id=$1`, [
        id,
      ]),
    );
    const job = rows[0];
    return job
      ? {
          ...rowToJobSummary(job),
          retryCount: job.retry_count ?? 0,
          retryLimit: job.retry_limit ?? null,
          singletonKey: job.singleton_key ?? null,
          expireInSeconds: job.expire_seconds ?? null,
          deadLetter: job.dead_letter ?? null,
          raw: job,
        }
      : null;
  }
  async getSchedules(): Promise<ScheduleInfo[]> {
    return this.safeOptionalQuery<ScheduleInfo>(
      "schedule",
      `select name, cron, data, timezone as tz, options as opts, created_on as created from ${this.q("schedule")} order by name`,
    );
  }
  async getWarnings(): Promise<PaginatedResponse<WarningInfo>> {
    const items = await this.safeOptionalQuery<WarningInfo>(
      "warning",
      `select id::text, created_on as "createdOn", type as name, message as detail from ${this.q("warning")} order by created_on desc limit 200`,
    );
    return { items, page: 1, pageSize: 200, total: items.length };
  }
  async getMetrics(): Promise<{ buckets: MetricPoint[] }> {
    const buckets = await this.withClient((c) =>
      this.safeQuery<MetricPoint>(
        c,
        `select date_trunc('hour', created_on)::text as bucket, count(*) filter (where state='created')::int as created, count(*) filter (where state='completed')::int as completed, count(*) filter (where state='failed')::int as failed, count(*) filter (where state='retry')::int as retry from ${this.q("job")} group by 1 order by 1 desc limit 168`,
      ),
    );
    return { buckets };
  }
  async getActivity(): Promise<{ items: ActivityPoint[] }> {
    const items = await this.withClient((c) =>
      this.safeQuery<ActivityPoint>(
        c,
        `select date_trunc('hour', coalesce(completed_on, created_on))::text as bucket, count(*) filter (where state='created')::int as created, count(*) filter (where state='completed')::int as completed, count(*) filter (where state='failed')::int as failed from ${this.q("job")} group by 1 order by 1 desc limit 168`,
      ),
    );
    return { items };
  }
  async getTagValues(field: string, limit = 50) {
    const safe = this.tagField(field);
    const rows = await this.withClient((c) =>
      this.safeQuery<any>(
        c,
        `select distinct (data ->> '${safe}') as value from ${this.q("job")} where data ->> '${safe}' is not null order by 1 limit $1`,
        [clamp(limit, 1, 200)],
      ),
    );
    return rows.map((r) => r.value);
  }
  async getDeadLetter(): Promise<PaginatedResponse<JobSummary>> {
    return this.listJobs({ state: "failed", limit: 100 });
  }

  private async countJobs(where: string[], args: unknown[]) {
    const rows = await this.withClient((c) =>
      this.safeQuery<any>(
        c,
        `select count(*)::int as total from ${this.q("job")}${where.length ? ` where ${where.join(" and ")}` : ""}`,
        args,
      ),
    );
    return rows[0]?.total ?? 0;
  }
  private async countState(state: BossbenchJobState) {
    const rows = await this.withClient((c) =>
      this.safeQuery<any>(
        c,
        `select count(*)::int as total from ${this.q("job")} where state=$1`,
        [state],
      ),
    );
    return rows[0]?.total ?? 0;
  }
  private async countOptional(table: string) {
    try {
      const rows = await this.safeOptionalQuery<any>(
        table,
        `select count(*)::int as total from ${this.q(table)}`,
      );
      return rows[0]?.total ?? 0;
    } catch {
      return 0;
    }
  }
  private async safeOptionalQuery<T>(
    table: string,
    sql: string,
    args: unknown[] = [],
  ) {
    try {
      return await this.withClient((c) => this.safeQuery<T>(c, sql, args));
    } catch (e: any) {
      if (String(e?.code) === "42P01") return [];
      throw e;
    }
  }
  private async safeQuery<T>(
    client: DbClient,
    sql: string,
    args: unknown[] = [],
  ) {
    const result = await client.query(sql, args);
    return result.rows as T[];
  }
  private async withClient<T>(fn: (client: DbClient) => Promise<T>) {
    return withDb(this.requireDb() as any, fn);
  }
  private tagField(field: string) {
    const safe = quoteTagField(field);
    if (this.tagFields.length > 0 && !this.tagFields.includes(safe))
      throw error("INVALID_FILTER", "Unknown tag field");
    return safe;
  }
}

function rowToJobSummary(row: any): JobSummary {
  return {
    id: String(row.id),
    name: row.name,
    queue: row.queue ?? row.name,
    state: row.state,
    createdOn: row.created_on ?? null,
    startedOn: row.started_on ?? null,
    completedOn: row.completed_on ?? null,
    priority: row.priority ?? null,
    data: row.data ?? null,
    output: row.output ?? null,
  };
}
function sortClause(sort?: string) {
  const allowed = new Set([
    "created_on",
    "started_on",
    "completed_on",
    "priority",
    "state",
    "name",
  ]);
  const [field = "created_on", dir = "desc"] = (
    sort ?? "created_on:desc"
  ).split(":");
  return `${allowed.has(field) ? field : "created_on"} ${dir.toLowerCase() === "asc" ? "asc" : "desc"}`;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function pushFilter(where: string[], args: unknown[], clause?: string) {
  if (clause) where.push(clause);
}
function quoteTagField(field: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field))
    throw error("INVALID_FILTER", "Invalid tag field");
  return field;
}
function error(code: string, message: string) {
  const e = new Error(message) as Error & { code: string };
  e.code = code;
  return e;
}

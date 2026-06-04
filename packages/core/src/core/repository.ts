import type { Client, Pool, PoolClient } from "pg";
import { withDb } from "./db";
import { quoteQualifiedIdentifier } from "./identifiers";
import type {
  ActivityPoint,
  AlertEvaluationSnapshot,
  BossbenchAlertRule,
  BossbenchJobState,
  JobDetail,
  JobSummary,
  MetricPoint,
  MetricsResponse,
  OverviewStats,
  PaginatedResponse,
  QueryFilters,
  QueueCleanDeleteRequest,
  QueueCleanPreviewRequest,
  QueueCleanPreviewResult,
  QueueDetail,
  QueueInfo,
  QueueMetricSummary,
  ScheduleInfo,
  WarningInfo,
} from "./types";

type DbClient = Pool | Client | PoolClient;
type Row = Record<string, unknown>;
type CountRow = { total: number };

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
      this.safeQuery<QueueInfo>(
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
    if (filters.future && !filters.state) {
      where.push("state in ('created','retry')");
    } else if (filters.state) {
      args.push(filters.state);
      where.push(`state = $${args.length}`);
    }
    if (filters.future) {
      where.push("start_after > now()");
    }
    if (filters.q) {
      args.push(`%${filters.q}%`);
      const i = args.length;
      where.push(
        `(id::text ILIKE $${i} OR name ILIKE $${i} OR state::text ILIKE $${i} OR data::text ILIKE $${i})`,
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
    const sql = `select id::text, name, name as queue, state::text, created_on, start_after, started_on, completed_on, priority, data, output from ${this.q("job")}${where.length ? ` where ${where.join(" and ")}` : ""} order by ${sortClause(filters.sort)} limit $${args.push(limit)} offset $${args.push(offset)}`;
    const items = await this.withClient((c) =>
      this.safeQuery<Row>(c, sql, args),
    );
    const total = await this.countJobs(where, args.slice(0, -2));
    return {
      items: items.map(rowToJobSummary),
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      total,
    };
  }
  async listFutureJobs(
    filters: QueryFilters = {},
  ): Promise<PaginatedResponse<JobSummary>> {
    return this.listJobs({
      ...filters,
      future: true,
      sort: filters.sort ?? "start_after:asc",
    });
  }
  async getJob(id: string): Promise<JobDetail | null> {
    const rows = await this.withClient((c) =>
      this.safeQuery<Row>(c, `select * from ${this.q("job")} where id=$1`, [
        id,
      ]),
    );
    const job = rows[0];
    return job
      ? {
          ...rowToJobSummary(job),
          retryCount: numberOrDefault(job.retry_count, 0),
          retryLimit: numberOrNull(job.retry_limit),
          singletonKey: stringOrNull(job.singleton_key),
          expireInSeconds: numberOrNull(job.expire_seconds),
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
  async getMetrics(): Promise<MetricsResponse> {
    const buckets = await this.withClient((c) =>
      this.safeQuery<MetricPoint>(
        c,
        `with created_rows as (
           select date_trunc('hour', created_on) as bucket, count(*) filter (where state='created')::int as created, 0::int as completed, 0::int as failed, count(*) filter (where state='retry')::int as retry, null::float8 as "avgDurationMs", null::float8 as "avgWaitMs"
           from ${this.q("job")}
           where created_on >= now() - interval '168 hours' and state in ('created', 'retry')
           group by 1
         ), terminal_rows as (
           select date_trunc('hour', completed_on) as bucket, 0::int as created, count(*) filter (where state='completed')::int as completed, count(*) filter (where state='failed')::int as failed, 0::int as retry, avg(extract(epoch from completed_on - started_on) * 1000) filter (where started_on is not null and completed_on is not null)::float8 as "avgDurationMs", avg(extract(epoch from started_on - created_on) * 1000) filter (where started_on is not null and created_on is not null)::float8 as "avgWaitMs"
           from ${this.q("job")}
           where completed_on >= now() - interval '168 hours' and state in ('completed', 'failed')
           group by 1
         )
         select bucket::text as bucket, sum(created)::int as created, sum(completed)::int as completed, sum(failed)::int as failed, sum(retry)::int as retry, avg("avgDurationMs")::float8 as "avgDurationMs", avg("avgWaitMs")::float8 as "avgWaitMs"
         from (select * from created_rows union all select * from terminal_rows) s group by 1 order by 1 desc limit 168`,
      ),
    );
    const summary = await this.withClient((c) =>
      this.safeQuery<SummaryRow>(
        c,
        `select
           count(*) filter (where state='created' and created_on >= now() - interval '168 hours')::int as "totalCreated",
           count(*) filter (where state='retry' and created_on >= now() - interval '168 hours')::int as "totalRetry",
           count(*) filter (where state='completed' and completed_on >= now() - interval '168 hours')::int as "totalCompleted",
           count(*) filter (where state='failed' and completed_on >= now() - interval '168 hours')::int as "totalFailed",
           coalesce(count(*) filter (where state in ('completed','failed') and completed_on >= now() - interval '168 hours')::float8 / 168.0, 0) as "throughputPerHour",
           coalesce(count(*) filter (where state='failed' and completed_on >= now() - interval '168 hours')::float8 / nullif(count(*) filter (where state in ('completed','failed') and completed_on >= now() - interval '168 hours'), 0), 0) as "errorRate",
           avg(extract(epoch from completed_on - started_on) * 1000) filter (where state in ('completed','failed') and completed_on >= now() - interval '168 hours' and started_on is not null) as "avgDurationMs",
           avg(extract(epoch from started_on - created_on) * 1000) filter (where state in ('completed','failed') and completed_on >= now() - interval '168 hours' and started_on is not null and created_on is not null) as "avgWaitMs"
         from ${this.q("job")}
         where created_on >= now() - interval '168 hours' or completed_on >= now() - interval '168 hours'`,
      ),
    ).then((rows) => rowToMetricsSummary(rows[0]));
    const queues = await this.withClient((c) =>
      this.safeQuery<Row>(
        c,
        `select name,
           count(*) filter (where state='created' and created_on >= now() - interval '168 hours')::int as created,
           count(*) filter (where state='retry' and created_on >= now() - interval '168 hours')::int as retry,
           count(*) filter (where state='completed' and completed_on >= now() - interval '168 hours')::int as completed,
           count(*) filter (where state='failed' and completed_on >= now() - interval '168 hours')::int as failed,
           coalesce(count(*) filter (where state='failed' and completed_on >= now() - interval '168 hours')::float8 / nullif(count(*) filter (where state in ('completed','failed') and completed_on >= now() - interval '168 hours'), 0), 0) as "errorRate",
           avg(extract(epoch from completed_on - started_on) * 1000) filter (where state in ('completed','failed') and completed_on >= now() - interval '168 hours' and started_on is not null and completed_on is not null)::float8 as "avgDurationMs",
           avg(extract(epoch from started_on - created_on) * 1000) filter (where state in ('completed','failed') and completed_on >= now() - interval '168 hours' and started_on is not null and created_on is not null)::float8 as "avgWaitMs",
           max(coalesce(completed_on, started_on, created_on)) as "lastActivity"
         from ${this.q("job")}
         where created_on >= now() - interval '168 hours' or completed_on >= now() - interval '168 hours'
         group by name order by name asc`,
      ),
    ).then((rows) => rows.map(rowToQueueMetrics));
    return { summary, buckets, queues };
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

  async cleanQueue(name: string, _request: QueueCleanDeleteRequest) {
    throw new Error(`cleanQueue not implemented for ${name}`);
  }

  async getAlertEvaluationSnapshot(
    rules?: BossbenchAlertRule[],
  ): Promise<AlertEvaluationSnapshot> {
    if (rules?.length) {
      const ruleValues = await this.getAlertRuleValues(rules);
      return emptyAlertEvaluationSnapshot(ruleValues);
    }

    const [overview, metrics, warnings, oldestCreatedAges] = await Promise.all([
      this.getOverview(),
      this.getMetrics(),
      this.getWarnings(),
      this.getOldestCreatedAges(),
    ]);

    return { overview, metrics, warnings, oldestCreatedAges };
  }

  async getAlertRuleValues(
    rules: BossbenchAlertRule[],
  ): Promise<Record<string, number>> {
    const entries = await Promise.all(
      rules.map(async (rule) => [rule.id, await this.getAlertRuleValue(rule)]),
    );
    return Object.fromEntries(entries);
  }

  private async getAlertRuleValue(rule: BossbenchAlertRule): Promise<number> {
    const scope = (windowColumn?: string, includeQueue = true) => {
      const args: unknown[] = [];
      const clauses: string[] = [];
      if (windowColumn && rule.windowMinutes !== undefined) {
        args.push(rule.windowMinutes);
        clauses.push(
          `${windowColumn} >= now() - ($${args.length}::int * interval '1 minute')`,
        );
      }
      if (includeQueue && rule.queue) {
        args.push(rule.queue);
        clauses.push(`name = $${args.length}`);
      }
      return {
        suffix: clauses.length ? ` and ${clauses.join(" and ")}` : "",
        args,
      };
    };

    if (rule.type === "failed_count" || rule.type === "dead_letter_count") {
      const { suffix, args } = scope("completed_on");
      const rows = await this.withClient((c) =>
        this.safeQuery<{ value: number }>(
          c,
          `select count(*)::int as value from ${this.q("job")} where state='failed'${suffix}`,
          args,
        ),
      );
      return numberOrDefault(rows[0]?.value, 0);
    }

    if (rule.type === "retry_backlog_count") {
      const { suffix, args } = scope("created_on");
      const rows = await this.withClient((c) =>
        this.safeQuery<{ value: number }>(
          c,
          `select count(*)::int as value from ${this.q("job")} where state='retry'${suffix}`,
          args,
        ),
      );
      return numberOrDefault(rows[0]?.value, 0);
    }

    if (rule.type === "warning_count") {
      const { suffix, args } = scope("created_on", false);
      const rows = await this.safeOptionalQuery<{ value: number }>(
        "warning",
        `select count(*)::int as value from ${this.q("warning")} where true${suffix}`,
        args,
      );
      return numberOrDefault(rows[0]?.value, 0);
    }

    if (rule.type === "avg_wait_ms") {
      const { suffix, args } = scope("created_on");
      const rows = await this.withClient((c) =>
        this.safeQuery<{ value: number | null }>(
          c,
          `select avg(extract(epoch from started_on - created_on) * 1000)::float8 as value from ${this.q("job")} where started_on is not null and created_on is not null${suffix}`,
          args,
        ),
      );
      return numberOrDefault(rows[0]?.value, 0);
    }

    if (rule.type === "avg_duration_ms") {
      const { suffix, args } = scope("completed_on");
      const rows = await this.withClient((c) =>
        this.safeQuery<{ value: number | null }>(
          c,
          `select avg(extract(epoch from completed_on - started_on) * 1000)::float8 as value from ${this.q("job")} where completed_on is not null and started_on is not null${suffix}`,
          args,
        ),
      );
      return numberOrDefault(rows[0]?.value, 0);
    }

    if (rule.type === "oldest_created_age") {
      const { suffix, args } = scope(undefined);
      const rows = await this.withClient((c) =>
        this.safeQuery<{ value: number | null }>(
          c,
          `select coalesce(max(extract(epoch from now() - created_on)), 0)::int as value from ${this.q("job")} where state in ('created','retry')${suffix}`,
          args,
        ),
      );
      return numberOrDefault(rows[0]?.value, 0);
    }

    return 0;
  }

  async getOldestCreatedAges(): Promise<Record<string, number>> {
    const rows = await this.withClient((c) =>
      this.safeQuery<{ name: string; ageSeconds: number }>(
        c,
        `select name, coalesce(max(extract(epoch from now() - created_on)), 0)::int as "ageSeconds" from ${this.q("job")} where state in ('created','retry') group by name`,
      ),
    );

    return Object.fromEntries(
      rows.map((row) => [row.name, numberOrDefault(row.ageSeconds, 0)]),
    );
  }

  async getTagValues(field: string, limit = 50) {
    const safe = this.tagField(field);
    const rows = await this.withClient((c) =>
      this.safeQuery<{ value: string | null }>(
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

  async previewQueueClean(
    queue: string,
    request: QueueCleanPreviewRequest,
  ): Promise<QueueCleanPreviewResult> {
    const limit = clamp(request.limit ?? 1000, 1, 5000);
    const cutoff = new Date(
      Date.now() - request.olderThanSeconds * 1000,
    ).toISOString();
    const rows = await this.withClient((c) =>
      this.safeQuery<Row>(
        c,
        `with filtered as (
           select id, completed_on
           from ${this.q("job")}
           where name = $1
             and state = $2
             and completed_on is not null
             and completed_on < $3::timestamptz
         ), sampled as (
           select id, completed_on
           from filtered
           order by completed_on asc, id asc
           limit $4
         )
         select
           (select count(*)::int from filtered) as "matchedCount",
           coalesce(array_agg(id::text order by completed_on asc, id asc), '{}'::text[]) as "sampleIds",
           (select count(*) from filtered) > $4 as "hasMore"
         from sampled`,
        [queue, request.state, cutoff, limit],
      ),
    );
    const row = rows[0] ?? {};
    return {
      queue,
      state: request.state,
      matched: numberOrDefault(row.matchedCount, 0),
      sampleIds: Array.isArray(row.sampleIds) ? row.sampleIds.map(String) : [],
      hasMore: Boolean(row.hasMore),
      cutoff,
    };
  }

  private async countJobs(where: string[], args: unknown[]) {
    const rows = await this.withClient((c) =>
      this.safeQuery<CountRow>(
        c,
        `select count(*)::int as total from ${this.q("job")}${where.length ? ` where ${where.join(" and ")}` : ""}`,
        args,
      ),
    );
    return rows[0]?.total ?? 0;
  }
  private async countState(state: BossbenchJobState) {
    const rows = await this.withClient((c) =>
      this.safeQuery<CountRow>(
        c,
        `select count(*)::int as total from ${this.q("job")} where state=$1`,
        [state],
      ),
    );
    return rows[0]?.total ?? 0;
  }
  private async countOptional(table: string) {
    try {
      const rows = await this.safeOptionalQuery<CountRow>(
        table,
        `select count(*)::int as total from ${this.q(table)}`,
      );
      return rows[0]?.total ?? 0;
    } catch {
      return 0;
    }
  }
  private async safeOptionalQuery<T>(
    _table: string,
    sql: string,
    args: unknown[] = [],
  ) {
    try {
      return await this.withClient((c) => this.safeQuery<T>(c, sql, args));
    } catch (e: unknown) {
      if (getErrorCode(e) === "42P01") return [];
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
    return withDb(this.requireDb(), fn);
  }
  private tagField(field: string) {
    const safe = quoteTagField(field);
    if (this.tagFields.length > 0 && !this.tagFields.includes(safe))
      throw error("INVALID_FILTER", "Unknown tag field");
    return safe;
  }
}

function rowToJobSummary(row: Row): JobSummary {
  const failureSnippet = summarizeFailureSnippet(row);
  return {
    id: String(row.id),
    name: String(row.name),
    queue: String(row.queue ?? row.name),
    state: row.state as BossbenchJobState,
    failureSnippet,
    createdOn: stringOrNull(row.created_on),
    startAfter: stringOrNull(row.start_after),
    startedOn: stringOrNull(row.started_on),
    completedOn: stringOrNull(row.completed_on),
    priority: numberOrNull(row.priority),
    data: row.data ?? null,
    output: row.output ?? null,
  };
}
function summarizeFailureSnippet(row: Row) {
  if (row.state !== "failed") return null;
  return summarizeSnippet(row.output);
}
function summarizeSnippet(value: unknown) {
  const text = toSnippetText(value);
  if (!text) return null;
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}
function toSnippetText(value: unknown) {
  if (typeof value === "string") return value.trim().replace(/\s+/g, " ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error", "reason", "output", "detail"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim())
        return candidate.trim().replace(/\s+/g, " ");
    }
    try {
      return JSON.stringify(value).slice(0, 120);
    } catch {
      return null;
    }
  }
  return null;
}
function sortClause(sort?: string) {
  const allowed = new Set([
    "created_on",
    "start_after",
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
function numberOrDefault(value: unknown, fallback: number) {
  return value === null || value === undefined ? fallback : Number(value);
}
function numberOrNull(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}
function stringOrNull(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value === null || value === undefined ? null : String(value);
}
function getErrorCode(error: unknown) {
  if (!(typeof error === "object" && error !== null && "code" in error)) {
    return undefined;
  }
  const code = (error as { code: unknown }).code;
  if (typeof code === "string" && code.length > 0) return code;
  if (typeof code === "number") return String(code);
  return undefined;
}

type SummaryRow = {
  totalCreated: number;
  totalCompleted: number;
  totalFailed: number;
  totalRetry: number;
  throughputPerHour: number;
  errorRate: number;
  avgDurationMs: number | null;
  avgWaitMs: number | null;
};

function rowToMetricsSummary(row?: SummaryRow): SummaryRow {
  return {
    totalCreated: numberOrDefault(row?.totalCreated, 0),
    totalCompleted: numberOrDefault(row?.totalCompleted, 0),
    totalFailed: numberOrDefault(row?.totalFailed, 0),
    totalRetry: numberOrDefault(row?.totalRetry, 0),
    throughputPerHour: numberOrDefault(row?.throughputPerHour, 0),
    errorRate: numberOrDefault(row?.errorRate, 0),
    avgDurationMs: numberOrNull(row?.avgDurationMs),
    avgWaitMs: numberOrNull(row?.avgWaitMs),
  };
}

function rowToQueueMetrics(row: Row): QueueMetricSummary {
  return {
    name: String(row.name),
    created: numberOrDefault(row.created, 0),
    completed: numberOrDefault(row.completed, 0),
    failed: numberOrDefault(row.failed, 0),
    retry: numberOrDefault(row.retry, 0),
    errorRate: numberOrDefault(row.errorRate, 0),
    avgDurationMs: numberOrNull(row.avgDurationMs),
    avgWaitMs: numberOrNull(row.avgWaitMs),
    lastActivity: stringOrNull(row.lastActivity),
  };
}

function emptyAlertEvaluationSnapshot(
  ruleValues: Record<string, number>,
): AlertEvaluationSnapshot {
  return {
    overview: {
      totals: {
        created: 0,
        retry: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
        failed: 0,
      },
      queues: [],
      deadLetter: 0,
      warnings: 0,
    },
    metrics: {
      summary: {
        totalCreated: 0,
        totalCompleted: 0,
        totalFailed: 0,
        totalRetry: 0,
        throughputPerHour: 0,
        errorRate: 0,
        avgDurationMs: null,
        avgWaitMs: null,
      },
      buckets: [],
      queues: [],
    },
    warnings: { items: [], page: 1, pageSize: 200, total: 0 },
    oldestCreatedAges: {},
    ruleValues,
  };
}

import type { Client, Pool } from "pg";
import type { PgBoss } from "pg-boss";

export type BossbenchJobState =
  | "created"
  | "retry"
  | "active"
  | "completed"
  | "cancelled"
  | "failed";

export interface BossbenchOptions {
  boss?: PgBoss;
  db?: string | Pool | Client;
  schema?: string;
  auth?: { username: string; password: string };
  allowUnauthenticated?: boolean;
  title?: string;
  logo?: string;
  basePath?: string;
  readonly?: boolean;
  tags?: string[];
}

export interface NormalizedBossbenchOptions extends BossbenchOptions {
  schema: string;
  title: string;
  readonly: boolean;
  tags: string[];
  basePath: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
export interface QueryFilters {
  limit?: number;
  offset?: number;
  queue?: string;
  state?: BossbenchJobState;
  q?: string;
  from?: string;
  to?: string;
  sort?: string;
  tags?: Record<string, string[]>;
}
export interface JobSummary {
  id: string;
  name: string;
  queue: string;
  state: BossbenchJobState;
  createdOn: string | null;
  startedOn: string | null;
  completedOn: string | null;
  priority: number | null;
  data: unknown;
  output: unknown;
}
export interface JobDetail extends JobSummary {
  retryCount: number;
  retryLimit: number | null;
  singletonKey: string | null;
  expireInSeconds: number | null;
  deadLetter?: unknown;
  raw: unknown;
}
export interface QueueInfo {
  name: string;
  total: number;
  created: number;
  retry: number;
  active: number;
  completed: number;
  cancelled: number;
  failed: number;
}
export interface QueueDetail extends QueueInfo {
  recentJobs: JobSummary[];
}
export interface OverviewStats {
  totals: Record<BossbenchJobState, number>;
  queues: QueueInfo[];
  deadLetter: number;
  warnings: number;
}
export interface ScheduleInfo {
  name: string;
  cron: string | null;
  data: unknown;
  tz: string | null;
  opts: unknown;
  created: string | null;
}
export interface WarningInfo {
  id: string;
  createdOn: string | null;
  name: string;
  detail: unknown;
}
export interface MetricPoint {
  bucket: string;
  created: number;
  completed: number;
  failed: number;
  retry: number;
  avgDurationMs: number | null;
  avgWaitMs: number | null;
}
export interface MetricsSummary {
  totalCreated: number;
  totalCompleted: number;
  totalFailed: number;
  totalRetry: number;
  throughputPerHour: number;
  errorRate: number;
  avgDurationMs: number | null;
  avgWaitMs: number | null;
}
export interface QueueMetricSummary {
  name: string;
  created: number;
  completed: number;
  failed: number;
  retry: number;
  errorRate: number;
  avgDurationMs: number | null;
  avgWaitMs: number | null;
  lastActivity: string | null;
}
export interface MetricsResponse {
  summary: MetricsSummary;
  buckets: MetricPoint[];
  queues: QueueMetricSummary[];
}
export interface ActivityPoint {
  bucket: string;
  created: number;
  completed: number;
  failed: number;
}

export interface BulkJobActionResult {
  succeeded: Array<{ id: string }>;
  failed: Array<{ id: string; code: string; message: string }>;
}

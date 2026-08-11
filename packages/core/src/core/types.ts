import type { Client, Pool } from "pg";
import type { PgBoss } from "pg-boss";

export type BossbenchJobState =
  | "created"
  | "retry"
  | "active"
  | "completed"
  | "cancelled"
  | "failed";

export type BossbenchAlertRuleType =
  | "failed_count"
  | "dead_letter_count"
  | "retry_backlog_count"
  | "oldest_created_age"
  | "avg_wait_ms"
  | "avg_duration_ms"
  | "warning_count";

export type BossbenchAlertSeverity = "info" | "warning" | "critical";

export interface BossbenchAlertRule {
  id: string;
  name: string;
  type: BossbenchAlertRuleType;
  queue?: string;
  windowMinutes?: number;
  threshold: number;
  severity?: BossbenchAlertSeverity;
  cooldownMinutes?: number;
  contactPointIds?: string[];
}

export type BossbenchAlertContactPointType = "webhook" | "slack" | "discord";

export interface BossbenchAlertContactPoint {
  id: string;
  name: string;
  type: BossbenchAlertContactPointType;
  url?: string;
  urlEnv?: string;
}

export interface BossbenchAlertsOptions {
  enabled?: boolean;
  rules?: BossbenchAlertRule[];
  contactPoints?: BossbenchAlertContactPoint[];
}

export interface BossbenchAuditEvent {
  type: "queue.clean.delete";
  at: string;
  queue: string;
  state: Extract<BossbenchJobState, "completed" | "failed">;
  cutoff: string;
  limit: number;
  deleted: number;
  deletedIds: string[];
  hasMore: boolean;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface NormalizedBossbenchAlertsOptions {
  enabled: boolean;
  rules: BossbenchAlertRule[];
  contactPoints: BossbenchAlertContactPoint[];
}

export interface BossbenchDatabaseInfo {
  id: string;
  name: string;
}

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
  allowManualEnqueue?: boolean;
  allowQueueClean?: boolean;
  allowQueueCleanDelete?: boolean;
  onAuditEvent?: (event: BossbenchAuditEvent) => void | Promise<void>;
  alerts?: BossbenchAlertsOptions;
  tags?: string[];
  /** Other databases this dashboard can switch to. Populated by multi-database hosts (e.g. the standalone app); framework adapters leave this unset. */
  databases?: BossbenchDatabaseInfo[];
  /** Which entry in `databases` this instance serves. */
  activeDatabaseId?: string;
}

export interface NormalizedBossbenchOptions extends BossbenchOptions {
  schema: string;
  title: string;
  readonly: boolean;
  allowManualEnqueue: boolean;
  allowQueueClean: boolean;
  allowQueueCleanDelete: boolean;
  alerts: NormalizedBossbenchAlertsOptions;
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
  future?: boolean;
}
export interface JobSummary {
  id: string;
  name: string;
  queue: string;
  state: BossbenchJobState;
  failureSnippet: string | null;
  createdOn: string | null;
  startAfter: string | null;
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

export interface BossbenchAlertViolation {
  ruleId: string;
  ruleName: string;
  type: BossbenchAlertRuleType;
  severity: BossbenchAlertSeverity;
  queue: string | null;
  threshold: number;
  current: number;
  windowMinutes: number | null;
  observedAt: string;
  fingerprint: string;
}

export interface BossbenchAlertsResponse {
  enabled: boolean;
  rules: BossbenchAlertRule[];
  contactPoints: Array<{
    id: string;
    name: string;
    type: BossbenchAlertContactPointType;
    configured: boolean;
  }>;
  violations: BossbenchAlertViolation[];
  delivery: {
    enabled: boolean;
    available: boolean;
  };
}

export interface AlertEvaluationSnapshot {
  overview: OverviewStats;
  metrics: MetricsResponse;
  warnings: PaginatedResponse<WarningInfo>;
  oldestCreatedAges?: Record<string, number>;
  ruleValues?: Record<string, number>;
}

export interface BulkJobActionResult {
  succeeded: Array<{ id: string }>;
  failed: Array<{ id: string; code: string; message: string }>;
}

export interface EnqueueJobRequest {
  data?: Record<string, unknown> | null;
  options?: {
    priority?: number;
    startAfter?: string | number;
  };
}

export interface EnqueueJobResult {
  id: string | null;
  enqueued: boolean;
}

export interface CloneJobResult extends EnqueueJobResult {
  sourceJobId: string;
  queue: string;
}

export interface QueueCleanPreviewRequest {
  state: Extract<BossbenchJobState, "completed" | "failed">;
  olderThanSeconds: number;
  limit?: number;
}

export interface QueueCleanPreviewResult {
  queue: string;
  state: Extract<BossbenchJobState, "completed" | "failed">;
  matched: number;
  sampleIds: string[];
  hasMore: boolean;
  cutoff: string;
}

export interface QueueCleanDeleteRequest {
  state: Extract<BossbenchJobState, "completed" | "failed">;
  cutoff: string;
  limit?: number;
  confirm: string;
}

export interface QueueCleanDeleteResult {
  queue: string;
  state: Extract<BossbenchJobState, "completed" | "failed">;
  cutoff: string;
  deleted: number;
  deletedIds: string[];
  hasMore: boolean;
}

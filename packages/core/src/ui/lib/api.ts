import type {
  ActivityPoint,
  BossbenchAlertsResponse,
  BossbenchJobState,
  BulkJobActionResult,
  CloneJobResult,
  EnqueueJobRequest,
  EnqueueJobResult,
  JobSummary,
  MetricsResponse,
  OverviewStats,
  PaginatedResponse,
  QueryFilters,
  QueueCleanDeleteRequest,
  QueueCleanDeleteResult,
  QueueCleanPreviewRequest,
  QueueCleanPreviewResult,
  QueueDetail,
  QueueInfo,
  ScheduleInfo,
  WarningInfo,
} from "../../core/types";

type MutationResponse<T> = { ok: true; result: T };

const apiBase = `${getBasePath()}/api`.replace(/\/\/api$/, "/api");

async function fetchJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { message?: unknown; detail?: unknown } }).error
        : null;
    const message =
      error?.message ?? error?.detail ?? `HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return payload as T;
}

export const api = {
  config: () =>
    fetchJson<{
      title?: string;
      schema?: string;
      basePath?: string;
      readonly?: boolean;
      hasBoss?: boolean;
      allowManualEnqueue?: boolean;
      allowQueueClean?: boolean;
      allowQueueCleanDelete?: boolean;
      tags?: string[];
    }>("/config"),
  overview: () => fetchJson<OverviewStats>("/overview"),
  alerts: () => fetchJson<BossbenchAlertsResponse>("/alerts"),
  queues: () => fetchJson<QueueInfo[]>("/queues"),
  queue: (name: string) =>
    fetchJson<QueueDetail>(`/queues/${encodeURIComponent(name)}`),
  queueJobs: (name: string, filters?: QueryFilters) =>
    fetchJson<PaginatedResponse<JobSummary>>(
      `/queues/${encodeURIComponent(name)}/jobs${buildJobsQuery(filters)}`,
    ),
  jobs: (filters?: QueryFilters) =>
    fetchJson<PaginatedResponse<JobSummary>>(`/jobs${buildJobsQuery(filters)}`),
  futureJobs: (filters?: QueryFilters) =>
    fetchJson<PaginatedResponse<JobSummary>>(
      `/future-jobs${buildJobsQuery(filters)}`,
    ),
  job: (id: string) => fetchJson<JobSummary>(`/jobs/${encodeURIComponent(id)}`),
  retryJob: (id: string) =>
    fetchJson(`/jobs/${encodeURIComponent(id)}/retry`, { method: "POST" }),
  cancelJob: (id: string) =>
    fetchJson(`/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  bulkRetryJobs: (ids: string[]) =>
    fetchJson<MutationResponse<BulkJobActionResult>>(`/jobs/bulk/retry`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  bulkCancelJobs: (ids: string[]) =>
    fetchJson<MutationResponse<BulkJobActionResult>>(`/jobs/bulk/cancel`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  resumeJob: (id: string) =>
    fetchJson(`/jobs/${encodeURIComponent(id)}/resume`, { method: "POST" }),
  deleteJob: (id: string) =>
    fetchJson(`/jobs/${encodeURIComponent(id)}/delete`, { method: "POST" }),
  bulkDeleteJobs: (ids: string[]) =>
    fetchJson<MutationResponse<BulkJobActionResult>>(`/jobs/bulk/delete`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  schedules: () => fetchJson<ScheduleInfo[]>("/schedules"),
  createSchedule: (body: { name: string; cron: string; data?: unknown }) =>
    fetchJson("/schedules", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runScheduleNow: (name: string) =>
    fetchJson<MutationResponse<{ id: string | null }>>(
      `/schedules/${encodeURIComponent(name)}/run-now`,
      { method: "POST" },
    ),
  unschedule: (name: string) =>
    fetchJson(`/schedules/${encodeURIComponent(name)}`, { method: "DELETE" }),
  deadLetter: () => fetchJson<PaginatedResponse<JobSummary>>("/dead-letter"),
  warnings: () => fetchJson<{ items: WarningInfo[] }>("/warnings"),
  metrics: () => fetchJson<MetricsResponse>("/metrics"),
  activity: () => fetchJson<{ items: ActivityPoint[] }>("/activity"),
  enqueueJob: (queue: string, request: EnqueueJobRequest) =>
    fetchJson<MutationResponse<EnqueueJobResult>>(
      `/queues/${encodeURIComponent(queue)}/enqueue`,
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    ),
  previewQueueClean: (queue: string, request: QueueCleanPreviewRequest) =>
    fetchJson<MutationResponse<QueueCleanPreviewResult>>(
      `/queues/${encodeURIComponent(queue)}/clean-preview`,
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    ),
  cleanQueue: (queue: string, request: QueueCleanDeleteRequest) =>
    fetchJson<MutationResponse<QueueCleanDeleteResult>>(
      `/queues/${encodeURIComponent(queue)}/clean`,
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    ),
  cloneJob: (id: string) =>
    fetchJson<MutationResponse<CloneJobResult>>(
      `/jobs/${encodeURIComponent(id)}/clone`,
      {
        method: "POST",
      },
    ),
  tagValues: (field: string, limit?: number) => {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set("limit", String(limit));
    const query = params.toString();
    return fetchJson<string[]>(
      `/tags/${encodeURIComponent(field)}/values${query ? `?${query}` : ""}`,
    );
  },
};

function getBasePath() {
  if (typeof document === "undefined" || typeof window === "undefined")
    return "";
  const base = document.querySelector("base")?.getAttribute("href");
  if (!base) return "";
  const pathname = new URL(base, window.location.href).pathname.replace(
    /\/$/,
    "",
  );
  return pathname === "/" ? "" : pathname;
}

export function buildJobsQuery(filters?: QueryFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  if (filters.queue) params.set("queue", filters.queue);
  if (filters.state) params.set("state", filters.state as BossbenchJobState);
  if (filters.q) params.set("q", filters.q);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.sort) params.set("sort", filters.sort);
  for (const [field, values] of Object.entries(filters.tags ?? {})) {
    for (const value of values) {
      if (value) params.append(`tag.${field}`, value);
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

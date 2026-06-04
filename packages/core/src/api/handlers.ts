import type { BossbenchCore } from "../core/core";
import type {
  BossbenchJobState,
  BulkJobActionResult,
  QueryFilters,
  QueueCleanDeleteRequest,
  QueueCleanPreviewRequest,
} from "../core/types";

export interface HandlerInput {
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface HandlerResult {
  status: number;
  body: unknown;
}

export type Handler = (input: HandlerInput) => Promise<HandlerResult>;

export interface RouteDef {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  handler: Handler;
}

type ScheduleRequest = {
  name?: unknown;
  cron?: unknown;
  data?: unknown;
};

const JOB_STATES = new Set<BossbenchJobState>([
  "created",
  "retry",
  "active",
  "completed",
  "cancelled",
  "failed",
]);

export function buildRouteTable(core: BossbenchCore): RouteDef[] {
  const { repository, actions } = core;

  return [
    {
      method: "get",
      path: "/config",
      handler: async () => ok(core.getConfig()),
    },
    { method: "post", path: "/refresh", handler: async () => ok({ ok: true }) },
    {
      method: "get",
      path: "/overview",
      handler: async () => ok(await repository.getOverview()),
    },
    {
      method: "get",
      path: "/alerts",
      handler: async () => ok(await core.getAlerts()),
    },
    {
      method: "get",
      path: "/queues",
      handler: async () => ok(await repository.listQueues()),
    },
    {
      method: "get",
      path: "/queues/:name",
      handler: async ({ params }) => {
        const name = required(
          params.name,
          "QUEUE_NOT_FOUND",
          "Queue not found",
        );
        return notFoundIfNull(
          await repository.getQueue(name),
          "QUEUE_NOT_FOUND",
          "Queue not found",
        );
      },
    },
    {
      method: "get",
      path: "/queues/:name/jobs",
      handler: async ({ params, query }) => {
        const name = required(
          params.name,
          "QUEUE_NOT_FOUND",
          "Queue not found",
        );
        const filters = parseFilters(query);
        filters.queue = name;
        return ok(await repository.listJobs(filters));
      },
    },
    {
      method: "get",
      path: "/jobs",
      handler: async ({ query }) =>
        ok(await repository.listJobs(parseFilters(query))),
    },
    {
      method: "get",
      path: "/future-jobs",
      handler: async ({ query }) =>
        ok(await repository.listFutureJobs(parseFilters(query))),
    },
    {
      method: "post",
      path: "/jobs/bulk/retry",
      handler: async ({ body }) =>
        mutate(async () =>
          bulkJobAction(
            repository,
            actions,
            actions.retryJob.bind(actions),
            body,
          ),
        ),
    },
    {
      method: "post",
      path: "/jobs/bulk/cancel",
      handler: async ({ body }) =>
        mutate(async () =>
          bulkJobAction(
            repository,
            actions,
            actions.cancelJob.bind(actions),
            body,
          ),
        ),
    },
    {
      method: "post",
      path: "/jobs/bulk/delete",
      handler: async ({ body }) =>
        mutate(async () =>
          bulkJobAction(
            repository,
            actions,
            actions.deleteJob.bind(actions),
            body,
          ),
        ),
    },
    {
      method: "post",
      path: "/queues/:name/enqueue",
      handler: async ({ params, body }) =>
        mutate(async () => {
          const name = required(
            params.name,
            "QUEUE_NOT_FOUND",
            "Queue not found",
          );
          const request = validateEnqueueBody(body);
          const payloadBytes = new TextEncoder().encode(
            JSON.stringify(request.data ?? null),
          ).length;
          if (payloadBytes > 262144)
            throw errorWithCode("INVALID_FILTER", "Payload too large");
          return actions.enqueueJob(name, request.data, request.options);
        }),
    },
    {
      method: "post",
      path: "/queues/:name/clean-preview",
      handler: async ({ params, body }) =>
        mutate(async () => {
          const name = required(
            params.name,
            "QUEUE_NOT_FOUND",
            "Queue not found",
          );
          const request = validateQueueCleanPreviewBody(body);
          actions.ensureQueueCleanAvailable();
          return repository.previewQueueClean(name, request);
        }),
    },
    {
      method: "post",
      path: "/queues/:name/clean",
      handler: async ({ params, body }) =>
        mutate(async () => {
          const name = required(
            params.name,
            "QUEUE_NOT_FOUND",
            "Queue not found",
          );
          const request = validateQueueCleanDeleteBody(body, name);
          actions.ensureQueueCleanDeleteAvailable();
          return core.cleanQueue(name, request);
        }),
    },
    {
      method: "get",
      path: "/jobs/:id",
      handler: async ({ params }) => {
        const id = required(params.id, "JOB_NOT_FOUND", "Job not found");
        return notFoundIfNull(
          await repository.getJob(id),
          "JOB_NOT_FOUND",
          "Job not found",
        );
      },
    },
    {
      method: "post",
      path: "/jobs/:id/clone",
      handler: async ({ params }) =>
        mutate(async () => {
          const id = required(params.id, "JOB_NOT_FOUND", "Job not found");
          const job = await repository.getJob(id);
          if (!job) throw errorWithCode("JOB_NOT_FOUND", "Job not found");
          const opts =
            job.priority === undefined || job.priority === null
              ? undefined
              : { priority: job.priority };
          const queue = job.queue ?? job.name;
          const result = (await actions.enqueueJob(queue, job.data, opts)) as {
            id?: string | null;
            enqueued?: boolean;
          };
          return {
            ...result,
            sourceJobId: job.id,
            queue,
          };
        }),
    },
    {
      method: "post",
      path: "/jobs/:id/retry",
      handler: async ({ params }) =>
        mutate(async () =>
          retryJob(
            repository,
            actions,
            required(params.id, "JOB_NOT_FOUND", "Job not found"),
          ),
        ),
    },
    {
      method: "post",
      path: "/jobs/:id/cancel",
      handler: async ({ params }) =>
        mutate(async () =>
          jobAction(
            repository,
            actions.cancelJob.bind(actions),
            required(params.id, "JOB_NOT_FOUND", "Job not found"),
          ),
        ),
    },
    {
      method: "post",
      path: "/jobs/:id/resume",
      handler: async ({ params }) =>
        mutate(async () =>
          jobAction(
            repository,
            actions.resumeJob.bind(actions),
            required(params.id, "JOB_NOT_FOUND", "Job not found"),
          ),
        ),
    },
    {
      method: "post",
      path: "/jobs/:id/delete",
      handler: async ({ params }) =>
        mutate(async () =>
          jobAction(
            repository,
            actions.deleteJob.bind(actions),
            required(params.id, "JOB_NOT_FOUND", "Job not found"),
          ),
        ),
    },
    {
      method: "get",
      path: "/schedules",
      handler: async () => ok(await repository.getSchedules()),
    },
    {
      method: "post",
      path: "/schedules",
      handler: async ({ body }) => {
        const schedule = body as ScheduleRequest | undefined;
        return mutate(async () => {
          const name = toStringOrEmpty(schedule?.name);
          const cron = toStringOrEmpty(schedule?.cron);
          if (!name || !cron) {
            throw errorWithCode(
              "INVALID_FILTER",
              "Missing schedule name or cron",
            );
          }
          return actions.createSchedule(name, cron, schedule?.data);
        });
      },
    },
    {
      method: "post",
      path: "/schedules/:name/run-now",
      handler: async ({ params }) => {
        const name = required(
          params.name,
          "INVALID_FILTER",
          "Invalid schedule name",
        );
        return mutate(async () => {
          const schedule = (await repository.getSchedules()).find(
            (candidate) => candidate.name === name,
          );
          if (!schedule) {
            throw errorWithCode("SCHEDULE_NOT_FOUND", "Schedule not found");
          }
          return actions.runScheduleNow(name, schedule.data, schedule.opts);
        });
      },
    },
    {
      method: "delete",
      path: "/schedules/:name",
      handler: async ({ params }) => {
        const name = required(
          params.name,
          "INVALID_FILTER",
          "Invalid schedule name",
        );
        return mutate(async () => actions.deleteSchedule(name));
      },
    },
    {
      method: "get",
      path: "/dead-letter",
      handler: async () => ok(await repository.getDeadLetter()),
    },
    {
      method: "get",
      path: "/warnings",
      handler: async () => ok(await repository.getWarnings()),
    },
    {
      method: "get",
      path: "/metrics",
      handler: async () => ok(await repository.getMetrics()),
    },
    {
      method: "get",
      path: "/activity",
      handler: async () => ok(await repository.getActivity()),
    },
    {
      method: "get",
      path: "/search",
      handler: async ({ query }) =>
        ok(await repository.listJobs(parseFilters(query))),
    },
    {
      method: "get",
      path: "/tags/:field/values",
      handler: async ({ params, query }) => {
        const field = required(
          params.field,
          "INVALID_FILTER",
          "Invalid tag field",
        );
        return ok(
          await repository.getTagValues(field, queryLimit(query.limit)),
        );
      },
    },
  ];
}

function parseFilters(
  query: Record<string, string | string[] | undefined>,
): QueryFilters {
  const tags: Record<string, string[]> = {};
  const filters: QueryFilters = { tags };

  const limit = toNumber(query.limit);
  if (limit !== undefined) filters.limit = limit;

  const offset = toNumber(query.offset);
  if (offset !== undefined) filters.offset = offset;

  const queue = firstValue(query.queue);
  if (queue !== undefined) filters.queue = queue;

  const state = firstValue(query.state);
  if (state) {
    if (!JOB_STATES.has(state as BossbenchJobState)) {
      throw errorWithCode("INVALID_FILTER", "Invalid job state");
    }
    filters.state = state as BossbenchJobState;
  }

  const q = firstValue(query.q);
  if (q !== undefined) filters.q = q;

  const from = firstValue(query.from);
  if (from !== undefined) filters.from = from;

  const to = firstValue(query.to);
  if (to !== undefined) filters.to = to;

  const sort = firstValue(query.sort);
  if (sort !== undefined) filters.sort = sort;

  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith("tag.")) continue;
    const tag = key.slice(4);
    const values = valuesFromQueryValue(value);
    if (values.length > 0) tags[tag] = values;
  }

  return filters;
}

function required(
  value: string | undefined,
  code: string,
  message: string,
): string {
  if (value === undefined || value === "") {
    throw errorWithCode(code, message);
  }
  return value;
}

function valuesFromQueryValue(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function queryLimit(value: string | string[] | undefined): number {
  return toNumber(value) ?? 50;
}

function toNumber(value: string | string[] | undefined): number | undefined {
  const raw = firstValue(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ok(body: unknown): HandlerResult {
  return { status: 200, body };
}

function notFoundIfNull<T>(
  value: T | null | undefined,
  code: string,
  message: string,
): HandlerResult {
  if (value === null || value === undefined)
    return { status: 404, body: jsonError(code, message) };
  return { status: 200, body: value };
}

async function retryJob(
  repository: BossbenchCore["repository"],
  actions: BossbenchCore["actions"],
  id: string,
) {
  return jobAction(repository, actions.retryJob.bind(actions), id);
}

async function jobAction(
  repository: BossbenchCore["repository"],
  action: (name: string, id: string) => Promise<unknown>,
  id: string,
) {
  const job = await repository.getJob(id);
  if (!job) throw errorWithCode("JOB_NOT_FOUND", "Job not found");
  return action(job.name, job.id);
}

async function bulkJobAction(
  repository: BossbenchCore["repository"],
  actions: BossbenchCore["actions"],
  action: (name: string, id: string) => Promise<unknown>,
  body: unknown,
): Promise<BulkJobActionResult> {
  actions.ensureAvailable();
  const ids = validateIds(body);
  const result: BulkJobActionResult = { succeeded: [], failed: [] };

  for (const id of ids) {
    const job = await repository.getJob(id);
    if (!job) {
      result.failed.push({
        id,
        code: "JOB_NOT_FOUND",
        message: "Job not found",
      });
      continue;
    }

    try {
      await action(job.name, job.id);
      result.succeeded.push({ id });
    } catch (error: unknown) {
      const code = errorCode(error);
      if (code === "READONLY_MODE" || code === "BOSS_INSTANCE_REQUIRED") {
        throw error;
      }
      result.failed.push({
        id,
        code: code ?? "ACTION_FAILED",
        message: "Action failed",
      });
    }
  }

  return result;
}

function validateIds(body: unknown): string[] {
  const ids =
    body && typeof body === "object" && "ids" in body
      ? (body as { ids?: unknown }).ids
      : undefined;

  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.some((id) => typeof id !== "string")
  ) {
    throw errorWithCode("INVALID_FILTER", "Invalid job ids");
  }

  const normalized = ids.map((id) => (typeof id === "string" ? id : ""));
  if (normalized.some((id) => id.length === 0)) {
    throw errorWithCode("INVALID_FILTER", "Invalid job ids");
  }

  return normalized;
}

async function mutate(fn: () => Promise<unknown>): Promise<HandlerResult> {
  try {
    return { status: 200, body: { ok: true, result: await fn() } };
  } catch (error: unknown) {
    const code = errorCode(error) ?? "ACTION_FAILED";
    return {
      status: mutationStatus(code),
      body: jsonError(code, mutationMessage(error, code)),
    };
  }
}

function mutationStatus(code: string): number {
  if (code === "JOB_NOT_FOUND" || code === "SCHEDULE_NOT_FOUND") return 404;
  if (
    code === "READONLY_MODE" ||
    code === "BOSS_INSTANCE_REQUIRED" ||
    code === "MANUAL_ENQUEUE_DISABLED" ||
    code === "QUEUE_CLEAN_DISABLED" ||
    code === "QUEUE_CLEAN_DELETE_DISABLED"
  )
    return 409;
  return 400;
}

function mutationMessage(error: unknown, code: string): string {
  if (code === "JOB_NOT_FOUND") return "Job not found";
  if (code === "SCHEDULE_NOT_FOUND") return "Schedule not found";
  if (code === "INVALID_FILTER") return errorMessage(error) ?? "Invalid filter";
  if (code === "READONLY_MODE" || code === "BOSS_INSTANCE_REQUIRED")
    return errorMessage(error) ?? "Action failed";
  if (code === "MANUAL_ENQUEUE_DISABLED") return "Manual enqueue is disabled";
  if (code === "QUEUE_CLEAN_DISABLED") return "Queue clean preview is disabled";
  if (code === "QUEUE_CLEAN_DELETE_DISABLED")
    return "Queue clean delete is disabled";
  return "Action failed";
}

function errorWithCode(code: string, message: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error))
    return undefined;
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function jsonError(code: string, message: string) {
  return { error: { code, message } };
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function toPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function validateQueueCleanPreviewBody(
  body: unknown,
): QueueCleanPreviewRequest {
  if (!body || typeof body !== "object")
    throw errorWithCode("INVALID_FILTER", "Invalid queue clean preview body");
  const candidate = body as {
    state?: unknown;
    olderThanSeconds?: unknown;
    limit?: unknown;
  };
  const state = toStringOrEmpty(candidate.state);
  if (state !== "completed" && state !== "failed")
    throw errorWithCode("INVALID_FILTER", "Invalid queue clean state");
  const olderThanSeconds = toPositiveInteger(candidate.olderThanSeconds);
  if (olderThanSeconds === undefined || olderThanSeconds < 3600)
    throw errorWithCode(
      "INVALID_FILTER",
      "olderThanSeconds must be at least 3600",
    );
  const limit =
    candidate.limit === undefined
      ? undefined
      : toPositiveInteger(candidate.limit);
  if (candidate.limit !== undefined && limit === undefined)
    throw errorWithCode("INVALID_FILTER", "limit must be a positive integer");
  if (limit !== undefined && limit > 5000)
    throw errorWithCode("INVALID_FILTER", "limit must be at most 5000");
  return {
    state: state as QueueCleanPreviewRequest["state"],
    olderThanSeconds,
    ...(limit !== undefined ? { limit } : {}),
  };
}

function validateQueueCleanDeleteBody(
  body: unknown,
  queue: string,
): QueueCleanDeleteRequest {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw errorWithCode("INVALID_FILTER", "Invalid queue clean delete body");
  const candidate = body as {
    state?: unknown;
    cutoff?: unknown;
    limit?: unknown;
    confirm?: unknown;
  };
  const state = toStringOrEmpty(candidate.state);
  if (state !== "completed" && state !== "failed")
    throw errorWithCode("INVALID_FILTER", "Invalid queue clean state");
  const cutoff = parseStrictIsoUtcTimestamp(candidate.cutoff);
  const cutoffDate = Date.parse(cutoff);
  if (Date.now() - cutoffDate < 3600_000)
    throw errorWithCode(
      "INVALID_FILTER",
      "cutoff must be at least 3600 seconds old",
    );
  const limit =
    candidate.limit === undefined
      ? undefined
      : toPositiveInteger(candidate.limit);
  if (candidate.limit !== undefined && limit === undefined)
    throw errorWithCode("INVALID_FILTER", "limit must be a positive integer");
  if (limit !== undefined && limit > 5000)
    throw errorWithCode("INVALID_FILTER", "limit must be at most 5000");
  const confirm = toStringOrEmpty(candidate.confirm);
  if (confirm !== `clean ${state} ${queue}`)
    throw errorWithCode("INVALID_FILTER", "Invalid confirmation");
  return {
    state: state as QueueCleanDeleteRequest["state"],
    cutoff,
    confirm,
    ...(limit !== undefined ? { limit } : {}),
  };
}

function validateEnqueueBody(body: unknown): {
  data: Record<string, unknown> | null;
  options?: { priority?: number; startAfter?: string | number };
} {
  if (body === undefined || body === null) return { data: {} };
  if (typeof body !== "object")
    throw errorWithCode("INVALID_FILTER", "Invalid enqueue body");
  const candidate = body as {
    data?: unknown;
    priority?: unknown;
    startAfter?: unknown;
    options?: { priority?: unknown; startAfter?: unknown };
  };
  const data = candidate.data ?? {};
  if (
    data !== null &&
    (!data || Array.isArray(data) || typeof data !== "object")
  )
    throw errorWithCode("INVALID_FILTER", "Invalid enqueue body");

  const rawOptions = candidate.options ?? {
    priority: candidate.priority,
    startAfter: candidate.startAfter,
  };
  const options: { priority?: number; startAfter?: string | number } = {};

  if (
    rawOptions.priority !== undefined &&
    !Number.isInteger(rawOptions.priority)
  )
    throw errorWithCode("INVALID_FILTER", "Invalid enqueue body");
  if (typeof rawOptions.priority === "number")
    options.priority = rawOptions.priority;
  if (rawOptions.startAfter !== undefined) {
    options.startAfter = normalizeStartAfter(rawOptions.startAfter);
  }

  return {
    data: data as Record<string, unknown> | null,
    ...(Object.keys(options).length ? { options } : {}),
  };
}

function normalizeStartAfter(value: unknown): string | number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.endsWith("Z")) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  throw errorWithCode("INVALID_FILTER", "Invalid enqueue body");
}

function parseStrictIsoUtcTimestamp(value: unknown): string {
  if (typeof value !== "string")
    throw errorWithCode("INVALID_FILTER", "Invalid cutoff");
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp))
    throw errorWithCode("INVALID_FILTER", "Invalid cutoff");
  const normalized = new Date(timestamp).toISOString();
  if (normalized !== value)
    throw errorWithCode("INVALID_FILTER", "Invalid cutoff");
  return value;
}

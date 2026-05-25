import type { Context } from "hono";
import { Hono } from "hono";
import { BossbenchCore } from "./core";
import type {
  BossbenchJobState,
  BossbenchOptions,
  QueryFilters,
} from "./types";

export function jsonError(code: string, message: string, details?: unknown) {
  return { error: { code, message, details } };
}

export function createApiRoutes(options: BossbenchOptions) {
  const core = BossbenchCore.create(options);
  const app = new Hono();
  app.onError((err, c) => {
    const code = (err as Error & { code?: string }).code ?? "DB_UNAVAILABLE";
    const status =
      code === "INVALID_FILTER"
        ? 400
        : code === "QUEUE_NOT_FOUND" || code === "JOB_NOT_FOUND"
          ? 404
          : 503;
    return c.json(jsonError(code, safeReadMessage(err)), status);
  });
  app.get("/config", (c) => c.json(core.getConfig()));
  app.post("/refresh", (c) => c.json({ ok: true }));
  app.get("/overview", async (c) =>
    jsonOk(c, await read(() => core.repository.getOverview())),
  );
  app.get("/queues", async (c) =>
    jsonOk(c, await read(() => core.repository.listQueues())),
  );
  app.get("/queues/:name", async (c) =>
    jsonOkOr404(
      c,
      await read(() => core.repository.getQueue(c.req.param("name"))),
      "QUEUE_NOT_FOUND",
      "Queue not found",
    ),
  );
  app.get("/queues/:name/jobs", async (c) =>
    jsonOk(
      c,
      await read(() =>
        core.repository.listJobs({
          ...parseFilters(c),
          queue: c.req.param("name"),
        }),
      ),
    ),
  );
  app.get("/jobs", async (c) =>
    jsonOk(c, await read(() => core.repository.listJobs(parseFilters(c)))),
  );
  app.get("/jobs/:id", async (c) =>
    jsonOkOr404(
      c,
      await read(() => core.repository.getJob(c.req.param("id"))),
      "JOB_NOT_FOUND",
      "Job not found",
    ),
  );
  app.post("/jobs/:id/retry", async (c) =>
    mutate(c, async () => {
      const job = await requireJob(core, c.req.param("id"));
      return core.actions.retryJob(job.name, job.id);
    }),
  );
  app.post("/jobs/:id/cancel", async (c) =>
    mutate(c, async () => {
      const job = await requireJob(core, c.req.param("id"));
      return core.actions.cancelJob(job.name, job.id);
    }),
  );
  app.post("/jobs/:id/resume", async (c) =>
    mutate(c, async () => {
      const job = await requireJob(core, c.req.param("id"));
      return core.actions.resumeJob(job.name, job.id);
    }),
  );
  app.post("/jobs/:id/delete", async (c) =>
    mutate(c, async () => {
      const job = await requireJob(core, c.req.param("id"));
      return core.actions.deleteJob(job.name, job.id);
    }),
  );
  app.get("/schedules", async (c) =>
    jsonOk(c, await read(() => core.repository.getSchedules())),
  );
  app.post("/schedules", async (c) =>
    mutate(c, async () => {
      const body: Partial<ScheduleRequest> = await c.req
        .json<Partial<ScheduleRequest>>()
        .catch(() => ({}));
      const name = String(body?.name ?? "");
      const cron = String(body?.cron ?? "");
      const data = body?.data;
      if (!name || !cron)
        throw badFilter("INVALID_FILTER", "Missing schedule name or cron");
      return core.actions.createSchedule(name, cron, data);
    }),
  );
  app.delete("/schedules/:name", async (c) =>
    mutate(c, () => core.actions.deleteSchedule(c.req.param("name"))),
  );
  app.get("/dead-letter", async (c) =>
    jsonOk(c, await read(() => core.repository.getDeadLetter())),
  );
  app.get("/warnings", async (c) =>
    jsonOk(c, await read(() => core.repository.getWarnings())),
  );
  app.get("/metrics", async (c) =>
    jsonOk(c, await read(() => core.repository.getMetrics())),
  );
  app.get("/activity", async (c) =>
    jsonOk(c, await read(() => core.repository.getActivity())),
  );
  app.get("/search", async (c) =>
    jsonOk(c, await read(() => core.repository.listJobs(parseFilters(c)))),
  );
  app.get("/tags/:field/values", async (c) =>
    jsonOk(
      c,
      await read(() =>
        core.repository.getTagValues(
          c.req.param("field"),
          Number(c.req.query("limit") ?? 50),
        ),
      ),
    ),
  );
  return app;
}

interface ScheduleRequest {
  name: string;
  cron: string;
  data?: unknown;
}

const JOB_STATES = new Set<BossbenchJobState>([
  "created",
  "retry",
  "active",
  "completed",
  "cancelled",
  "failed",
]);

function parseFilters(c: Context): QueryFilters {
  const tags: Record<string, string[]> = {};
  const params = new URL(c.req.url).searchParams;
  for (const [key, value] of params.entries()) {
    if (key.startsWith("tag.")) {
      const field = key.slice(4);
      tags[field] = [value];
    }
  }
  const filters: QueryFilters = { tags };
  const limit = n(c.req.query("limit"));
  if (limit !== undefined) filters.limit = limit;
  const offset = n(c.req.query("offset"));
  if (offset !== undefined) filters.offset = offset;
  const queue = c.req.query("queue");
  if (queue) filters.queue = queue;
  const state = c.req.query("state");
  if (state) {
    if (!isJobState(state))
      throw badFilter("INVALID_FILTER", "Invalid job state");
    filters.state = state;
  }
  const q = c.req.query("q");
  if (q) filters.q = q;
  const from = c.req.query("from");
  if (from) filters.from = from;
  const to = c.req.query("to");
  if (to) filters.to = to;
  const sort = c.req.query("sort");
  if (sort) filters.sort = sort;
  return filters;
}

async function read(fn: () => Promise<unknown>) {
  try {
    return await fn();
  } catch (e: unknown) {
    throw normalizeReadError(e);
  }
}
async function jsonOk(c: Context, data: unknown) {
  return c.json(data);
}
async function jsonOkOr404<T>(
  c: Context,
  data: T | null | undefined,
  code: string,
  message: string,
) {
  if (!data) return c.json(jsonError(code, message), 404);
  return c.json(data);
}
async function requireJob(core: BossbenchCore, id: string) {
  const job = await core.repository.getJob(id);
  if (!job) throw badFilter("JOB_NOT_FOUND", "Job not found");
  return job;
}
async function mutate(c: Context, fn: () => Promise<unknown>) {
  try {
    return c.json({ ok: true, result: await fn() });
  } catch (e: unknown) {
    const code = getErrorCode(e) ?? "ACTION_FAILED";
    const status =
      code === "JOB_NOT_FOUND"
        ? 404
        : code === "READONLY_MODE" || code === "BOSS_INSTANCE_REQUIRED"
          ? 409
          : 400;
    return c.json(jsonError(code, safeMessage(e)), status);
  }
}
function n(v: string | undefined) {
  return v === null || v === undefined ? undefined : Number(v);
}
function safeMessage(e: unknown) {
  const code = getErrorCode(e);
  return [
    "READONLY_MODE",
    "BOSS_INSTANCE_REQUIRED",
    "DB_UNAVAILABLE",
    "INVALID_FILTER",
    "JOB_NOT_FOUND",
  ].includes(code ?? "")
    ? (getErrorMessage(e) ?? "Action failed")
    : "Action failed";
}
function safeReadMessage(e: unknown) {
  const code = (e as Error & { code?: string })?.code;
  return code === "INVALID_FILTER"
    ? (e as Error).message
    : code === "QUEUE_NOT_FOUND"
      ? "Queue not found"
      : code === "JOB_NOT_FOUND"
        ? "Job not found"
        : "Database unavailable";
}
function normalizeReadError(e: unknown) {
  const originalCode = getErrorCode(e);
  const code: string =
    originalCode === "42P01"
      ? "DB_UNAVAILABLE"
      : ["DB_UNAVAILABLE", "INVALID_FILTER"].includes(originalCode ?? "")
        ? (originalCode ?? "DB_UNAVAILABLE")
        : "DB_UNAVAILABLE";
  return badFilter(
    code,
    code === "DB_UNAVAILABLE"
      ? "Database unavailable"
      : (getErrorMessage(e) ?? "Invalid filter"),
  );
}
function isJobState(state: string): state is BossbenchJobState {
  return JOB_STATES.has(state as BossbenchJobState);
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
function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}
function badFilter(code: string, message: string) {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

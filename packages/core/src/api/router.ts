import { Hono } from "hono";
import type { BossbenchCore } from "../core/core";
import { buildRouteTable } from "./handlers";

export function createApiRoutes(core: BossbenchCore): Hono {
  const app = new Hono();

  for (const route of buildRouteTable(core)) {
    app[route.method](route.path, async (c) => {
      try {
        const body = await parseBody(c.req.method, c.req.raw);
        const result = await route.handler({
          params: c.req.param(),
          query: queryToObject(c.req.query()),
          body,
        });
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: unknown) {
        const readError = toReadError(normalizeReadError(error));
        return new Response(JSON.stringify(readError.body), {
          status: readError.status,
          headers: { "Content-Type": "application/json" },
        });
      }
    });
  }

  return app;
}

function queryToObject(
  query: Record<string, string | undefined>,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

async function parseBody(method: string, request: Request): Promise<unknown> {
  if (method === "GET" || method === "HEAD") return undefined;
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function toReadError(error: unknown): { status: number; body: unknown } {
  const code = errorCode(error);
  if (code === "INVALID_FILTER") {
    return {
      status: 400,
      body: {
        error: { code, message: errorMessage(error) ?? "Invalid filter" },
      },
    };
  }

  if (code === "QUEUE_NOT_FOUND" || code === "JOB_NOT_FOUND") {
    return {
      status: 404,
      body: { error: { code, message: errorMessage(error) ?? "Not found" } },
    };
  }

  return {
    status: 503,
    body: {
      error: {
        code: code ?? "DB_UNAVAILABLE",
        message:
          code === "DB_UNAVAILABLE"
            ? "Database unavailable"
            : "Database unavailable",
      },
    },
  };
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error))
    return undefined;
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value : undefined;
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function normalizeReadError(error: unknown): Error & { code: string } {
  const originalCode = errorCode(error);
  if (originalCode === "INVALID_FILTER") {
    return errorWithCode(
      "INVALID_FILTER",
      errorMessage(error) ?? "Invalid filter",
    );
  }
  if (originalCode === "QUEUE_NOT_FOUND") {
    return errorWithCode("QUEUE_NOT_FOUND", "Queue not found");
  }
  if (originalCode === "JOB_NOT_FOUND") {
    return errorWithCode("JOB_NOT_FOUND", "Job not found");
  }
  return errorWithCode("DB_UNAVAILABLE", "Database unavailable");
}

function errorWithCode(code: string, message: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

import type { BossbenchCore } from "../core/core";
import { buildRouteTable, type HandlerInput } from "./handlers";

export interface FetchHandlerOptions {
  basePath?: string;
}

export function createFetchHandler(
  core: BossbenchCore,
  options: FetchHandlerOptions = {},
) {
  const routes = buildRouteTable(core);
  const basePath = normalizeBasePath(options.basePath ?? "/api");

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = stripBasePath(url.pathname, basePath);
    if (pathname === null) {
      return jsonResponse(
        { error: { code: "NOT_FOUND", message: "Not found" } },
        404,
      );
    }

    for (const route of routes) {
      if (route.method.toUpperCase() !== request.method.toUpperCase()) continue;
      const params = matchRoute(route.path, pathname);
      if (!params) continue;

      const body = isBodyMethod(request.method)
        ? await readJsonBody(request)
        : undefined;
      try {
        const result = await route.handler({
          params,
          query: queryToObject(url.searchParams),
          body,
        } satisfies HandlerInput);
        return jsonResponse(result.body, result.status);
      } catch (error: unknown) {
        const normalized = normalizeReadError(error);
        return jsonResponse(
          readError(normalized),
          statusForReadError(normalized),
        );
      }
    }

    return jsonResponse(
      { error: { code: "NOT_FOUND", message: "Not found" } },
      404,
    );
  };
}

function normalizeBasePath(basePath: string): string {
  if (basePath === "/") return "/";
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

function stripBasePath(pathname: string, basePath: string): string | null {
  if (basePath === "/") return pathname;
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`))
    return pathname.slice(basePath.length);
  return null;
}

function isBodyMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

function queryToObject(
  searchParams: URLSearchParams,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of searchParams.entries()) {
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  }
  return result;
}

function matchRoute(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const patternSegments = splitPath(pattern);
  const pathSegments = splitPath(pathname);
  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];
    if (patternSegment === undefined || pathSegment === undefined) return null;

    if (patternSegment.startsWith(":")) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }

    if (patternSegment !== pathSegment) return null;
  }

  return params;
}

function splitPath(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function readError(error: unknown) {
  const code = errorCode(error) ?? "INTERNAL_ERROR";
  return {
    error: { code, message: errorMessage(error) ?? "Internal server error" },
  };
}

function statusForReadError(error: unknown): number {
  const code = errorCode(error);
  if (code === "INVALID_FILTER") return 400;
  if (code === "QUEUE_NOT_FOUND" || code === "JOB_NOT_FOUND") return 404;
  return 503;
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

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

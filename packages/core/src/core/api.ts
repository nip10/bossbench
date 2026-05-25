import { createApiRoutes as createHonoApiRoutes } from "../api/router";
import { BossbenchCore } from "./core";

export function jsonError(code: string, message: string, details?: unknown) {
  return { error: { code, message, details } };
}

export function createApiRoutes(
  options: Parameters<typeof BossbenchCore.create>[0],
) {
  return createHonoApiRoutes(BossbenchCore.create(options));
}

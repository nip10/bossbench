import type { BossbenchOptions } from "@bossbench/core";
import {
  BossbenchCore,
  buildRouteTable,
  checkBasicAuth,
  renderIndexHtml,
  resolveBasePath,
  serveStaticAsset,
} from "@bossbench/core";
import type { FastifyPluginAsync } from "fastify";

export function bossbench(options: BossbenchOptions): FastifyPluginAsync {
  const core = BossbenchCore.create(options);

  return async (app) => {
    app.addHook("onRequest", async (request, reply) => {
      if (!core.requiresAuth()) return;
      const auth = core.options.auth;
      if (
        !checkBasicAuth(
          request.headers.authorization,
          auth?.username ?? "",
          auth?.password ?? "",
        )
      ) {
        void reply
          .code(401)
          .header("WWW-Authenticate", 'Basic realm="Bossbench"')
          .send({
            error: { code: "UNAUTHORIZED", message: "Authentication required" },
          });
        return reply;
      }
    });

    for (const route of buildRouteTable(core)) {
      app.route({
        method: route.method.toUpperCase() as never,
        url: `/api${route.path}`,
        handler: async (request, reply) => {
          try {
            const result = await route.handler({
              params: request.params as Record<string, string>,
              query: request.query as Record<
                string,
                string | string[] | undefined
              >,
              body: request.body,
            });
            void reply.code(result.status).send(result.body);
          } catch (error) {
            const normalized = normalizeReadError(error);
            void reply.code(statusForError(normalized)).send({
              error: { code: normalized.code, message: normalized.message },
            });
          }
        },
      });
    }

    app.get("/assets/*", async (request, reply) => {
      const asset = serveStaticAsset(
        String((request.params as { "*"?: string })["*"] ?? ""),
      );
      if (asset.status === 404 || !asset.body) return reply.code(404).send();
      return reply.type(asset.contentType).send(asset.body);
    });

    app.get("*", async (request, reply) => {
      const basePath = resolveBasePath(
        core.options.basePath,
        request.originalUrl.split("?")[0] ?? request.url,
      );
      const html = renderIndexHtml(basePath, core.options.title);
      return reply.type(html.contentType).send(html.body);
    });
  };
}

function normalizeReadError(error: unknown): Error & { code: string } {
  const code = errorCode(error);
  if (code === "INVALID_FILTER")
    return errorWithCode(code, errorMessage(error) ?? "Invalid filter");
  if (code === "QUEUE_NOT_FOUND") return errorWithCode(code, "Queue not found");
  if (code === "JOB_NOT_FOUND") return errorWithCode(code, "Job not found");
  return errorWithCode("DB_UNAVAILABLE", "Database unavailable");
}

function statusForError(error: Error & { code: string }) {
  if (error.code === "INVALID_FILTER") return 400;
  if (error.code === "QUEUE_NOT_FOUND" || error.code === "JOB_NOT_FOUND")
    return 404;
  return 503;
}

function errorWithCode(code: string, message: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error))
    return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}

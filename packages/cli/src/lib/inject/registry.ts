import type { Framework } from "../framework-detect.js";
import { expressInjector } from "./express.js";
import { honoInjector } from "./hono.js";
import { nextInjector } from "./next.js";

type Injector = (input: {
  cwd: string;
  entry: string | null;
  mountPath: string;
  withAuth: boolean;
}) => Promise<{
  ok: boolean;
  path: string | null;
  source: string;
  reason?: string;
}>;

export const INJECTORS: Record<Framework, Injector> = {
  hono: honoInjector,
  express: expressInjector,
  fastify: unsupported("fastify", "@bossbench/fastify"),
  elysia: unsupported("elysia", "@bossbench/elysia"),
  nestjs: unsupported("nestjs", "@bossbench/nestjs"),
  next: nextInjector,
};

function unsupported(framework: Framework, adapterPackage: string): Injector {
  return async ({ mountPath }) => ({
    ok: false,
    path: null,
    source: "",
    reason: `${framework} detected. ${adapterPackage} lands in issue #4; after installing it, mount Bossbench at ${mountPath} with db: process.env.DATABASE_URL, basePath: ${JSON.stringify(mountPath)}, and auth from BOSSBENCH_USER/BOSSBENCH_PASS.`,
  });
}

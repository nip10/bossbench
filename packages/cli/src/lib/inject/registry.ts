import { readFileSync } from "node:fs";
import type { Framework } from "../framework-detect.js";
import { adonisInjector } from "./adonis.js";
import { expressInjector } from "./express.js";
import { h3Injector } from "./h3.js";
import { honoInjector } from "./hono.js";
import { nextInjector } from "./next.js";
import { nuxtInjector } from "./nuxt.js";
import { tanstackStartInjector } from "./tanstack-start.js";

type Injector = (input: {
  cwd: string;
  entry: string | null;
  mountPath: string;
  withAuth: boolean;
}) => Promise<{
  ok: boolean;
  path: string | null;
  source: string;
  files?: Array<{ path: string; source: string }>;
  reason?: string;
}>;

export const INJECTORS: Record<Framework, Injector> = {
  hono: honoInjector,
  h3: h3Injector,
  nuxt: nuxtInjector,
  adonis: adonisInjector,
  "tanstack-start": tanstackStartInjector,
  express: expressInjector,
  fastify: fastifyInjector,
  elysia: elysiaInjector,
  nestjs: nestjsInjector,
  next: nextInjector,
};

async function fastifyInjector({
  entry,
  mountPath,
  withAuth,
}: {
  entry: string | null;
  mountPath: string;
  withAuth: boolean;
}) {
  return injectIntoEntry(
    entry,
    "@bossbench/fastify",
    fastifySnippet(mountPath, withAuth),
  );
}

async function elysiaInjector({
  entry,
  mountPath,
  withAuth,
}: {
  entry: string | null;
  mountPath: string;
  withAuth: boolean;
}) {
  return injectIntoEntry(
    entry,
    "@bossbench/elysia",
    elysiaSnippet(mountPath, withAuth),
  );
}

async function nestjsInjector({
  entry,
  mountPath,
  withAuth,
}: {
  entry: string | null;
  mountPath: string;
  withAuth: boolean;
}) {
  return injectIntoEntry(
    entry,
    "@bossbench/nestjs",
    nestSnippet(mountPath, withAuth),
  );
}

function injectIntoEntry(entry: string | null, pkg: string, snippet: string) {
  if (!entry)
    return { ok: false, path: null, source: "", reason: "No entry file found" };
  const source = readFileSync(entry, "utf8");
  if (source.includes("bossbench(")) return { ok: true, path: entry, source };
  const importLine = source.includes(`import { bossbench } from "${pkg}";`)
    ? ""
    : `import { bossbench } from "${pkg}";\n`;
  const insertion = `${snippet}\n`;
  const listenMatch = source.match(/\n\s*(?:await\s+)?app\.listen\s*\(/);
  const exportMatch = source.match(/\n\s*export\s+default\s+app\s*;?/);
  const index = listenMatch?.index ?? exportMatch?.index;
  if (index === undefined) {
    return {
      ok: false,
      path: null,
      source: "",
      reason: "No safe insertion point found",
    };
  }
  return {
    ok: true,
    path: entry,
    source: `${importLine}${source.slice(0, index)}\n${insertion}${source.slice(index)}`,
  };
}

function authGuard(withAuth: boolean) {
  return withAuth
    ? `const bossbenchUser = process.env.BOSSBENCH_USER;
const bossbenchPass = process.env.BOSSBENCH_PASS;
if (!bossbenchUser || !bossbenchPass) throw new Error("Set BOSSBENCH_USER and BOSSBENCH_PASS before mounting Bossbench");
`
    : "";
}

function optionsSnippet(mountPath: string, withAuth: boolean) {
  return `{
  db: process.env.DATABASE_URL,
  basePath: ${JSON.stringify(mountPath)},
${withAuth ? `  auth: { username: bossbenchUser, password: bossbenchPass },\n` : `  allowUnauthenticated: true,\n`}  // TODO: pass a PgBoss instance as 'boss' for actions
}`;
}

function fastifySnippet(mountPath: string, withAuth: boolean) {
  return `${authGuard(withAuth)}await app.register(bossbench(${optionsSnippet(mountPath, withAuth)}), { prefix: ${JSON.stringify(mountPath)} });`;
}

function elysiaSnippet(mountPath: string, withAuth: boolean) {
  return `${authGuard(withAuth)}app.mount(${JSON.stringify(mountPath)}, bossbench(${optionsSnippet(mountPath, withAuth)}));`;
}

function nestSnippet(mountPath: string, withAuth: boolean) {
  return `${authGuard(withAuth)}await bossbench(app, ${JSON.stringify(mountPath)}, ${optionsSnippet(mountPath, withAuth)});`;
}

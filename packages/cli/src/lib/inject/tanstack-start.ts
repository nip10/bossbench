import { join } from "node:path";
import type { InjectorOutput } from "./h3.js";
import { relativeImport } from "./relative-import.js";

export async function tanstackStartInjector({
  cwd = "",
  mountPath,
  withAuth,
}: {
  cwd?: string;
  entry: string | null;
  mountPath: string;
  withAuth: boolean;
}): Promise<InjectorOutput> {
  const routeName = mountPath.replace(/^\//, "") || "jobs";
  const handlersPath = join(cwd, "src/lib/bossbench-handlers.ts");
  const bareRoutePath = join(cwd, `src/routes/${routeName}.ts`);
  const catchAllRoutePath = join(cwd, `src/routes/${routeName}/$.ts`);
  const files = [
    {
      path: handlersPath,
      source: `import { bossbench } from "@bossbench/tanstack-start";

${withAuth ? authGuard() : ""}export const { GET, POST, PUT, PATCH, DELETE } = bossbench({
  db: process.env.DATABASE_URL,
  basePath: ${JSON.stringify(mountPath)},
${
  withAuth
    ? `  auth: { username: bossbenchUser, password: bossbenchPass },
`
    : `  allowUnauthenticated: true,
`
}  // TODO: pass a PgBoss instance as 'boss' for actions
});
`,
    },
    {
      path: bareRoutePath,
      source: `import { createFileRoute } from "@tanstack/react-router";
import { DELETE, GET, PATCH, POST, PUT } from "${relativeImport(bareRoutePath, handlersPath)}";

export const Route = createFileRoute(${JSON.stringify(mountPath)} as never)({
  server: { handlers: { DELETE, GET, PATCH, POST, PUT } },
} as never);
`,
    },
    {
      path: catchAllRoutePath,
      source: `import { createFileRoute } from "@tanstack/react-router";
import { DELETE, GET, PATCH, POST, PUT } from "${relativeImport(catchAllRoutePath, handlersPath)}";

export const Route = createFileRoute(${JSON.stringify(`${mountPath}/$`)} as never)({
  server: { handlers: { DELETE, GET, PATCH, POST, PUT } },
} as never);
`,
    },
  ];

  return {
    ok: true,
    path: files[0]?.path ?? null,
    source: files[0]?.source ?? "",
    files,
  };
}

function authGuard() {
  return `const bossbenchUser = process.env.BOSSBENCH_USER;
const bossbenchPass = process.env.BOSSBENCH_PASS;
if (!bossbenchUser || !bossbenchPass) throw new Error("Set BOSSBENCH_USER and BOSSBENCH_PASS before mounting Bossbench");

`;
}

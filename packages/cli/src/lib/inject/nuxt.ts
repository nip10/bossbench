import { join } from "node:path";
import type { InjectorOutput } from "./h3.js";
import { relativeImport } from "./relative-import.js";

export async function nuxtInjector({
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
  const utilsPath = join(cwd, "server/utils/bossbench.ts");
  const bareRoutePath = join(cwd, `server/routes/${routeName}.ts`);
  const catchAllRoutePath = join(cwd, `server/routes/${routeName}/[...].ts`);
  const files = [
    {
      path: utilsPath,
      source: `import { bossbench } from "@bossbench/nuxt";

${withAuth ? authGuard() : ""}export default bossbench({
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
      source: `export { default } from "${relativeImport(bareRoutePath, utilsPath)}";
`,
    },
    {
      path: catchAllRoutePath,
      source: `export { default } from "${relativeImport(catchAllRoutePath, utilsPath)}";
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

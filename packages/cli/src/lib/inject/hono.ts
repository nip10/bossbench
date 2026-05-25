import { readFileSync } from "node:fs";

export interface InjectorInput {
  cwd?: string;
  entry: string | null;
  mountPath: string;
  withAuth: boolean;
}

export interface InjectorOutput {
  ok: boolean;
  path: string | null;
  source: string;
  reason?: string;
}

export async function honoInjector({
  entry,
  mountPath,
  withAuth,
}: InjectorInput): Promise<InjectorOutput> {
  const authSetup = withAuth
    ? `const bossbenchUser = process.env.BOSSBENCH_USER;
const bossbenchPass = process.env.BOSSBENCH_PASS;
if (!bossbenchUser || !bossbenchPass) throw new Error("Set BOSSBENCH_USER and BOSSBENCH_PASS before mounting Bossbench");
`
    : "";
  const authOption = withAuth
    ? `  auth: { username: bossbenchUser, password: bossbenchPass },\n`
    : "";
  return inject(
    entry,
    mountPath,
    "@bossbench/hono",
    `${authSetup}app.route(${JSON.stringify(mountPath)}, bossbench({\n  db: process.env.DATABASE_URL,\n  basePath: ${JSON.stringify(mountPath)},\n${authOption}${withAuth ? "" : "  allowUnauthenticated: true,\n"}  // TODO: pass a PgBoss instance as 'boss' for actions\n}));`,
  );
}

function inject(
  entry: string | null,
  _mountPath: string,
  pkg: string,
  snippet: string,
): InjectorOutput {
  if (!entry)
    return { ok: false, path: null, source: "", reason: "No entry file found" };
  const src = readFileSync(entry, "utf8");
  if (src.includes(pkg) && src.includes("bossbench("))
    return { ok: true, path: entry, source: src };
  if (!/export\s+default\s+app\s*;?/.test(src))
    return {
      ok: false,
      path: null,
      source: "",
      reason: "No supported app export found",
    };
  const out = `${src.includes(`import { bossbench } from "${pkg}";`) ? "" : `import { bossbench } from "${pkg}";\n`}${src.replace(/export\s+default\s+app\s*;?/, `${snippet}\n\nexport default app;`)}`;
  return { ok: true, path: entry, source: out };
}

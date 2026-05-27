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

export async function h3Injector({
  entry,
  mountPath,
  withAuth,
}: InjectorInput): Promise<InjectorOutput> {
  return inject(
    entry,
    "@bossbench/h3",
    `${authGuard(withAuth)}const bossbenchHandler = bossbench({
  db: process.env.DATABASE_URL,
  basePath: ${JSON.stringify(mountPath)},
${withAuth ? `  auth: { username: bossbenchUser, password: bossbenchPass },\n` : `  allowUnauthenticated: true,\n`}  // TODO: pass a PgBoss instance as 'boss' for actions
});
app.use(${JSON.stringify(mountPath)}, bossbenchHandler);
app.use(${JSON.stringify(`${mountPath}/**`)}, bossbenchHandler);`,
  );
}

function inject(
  entry: string | null,
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

function authGuard(withAuth: boolean) {
  return withAuth
    ? `const bossbenchUser = process.env.BOSSBENCH_USER;
const bossbenchPass = process.env.BOSSBENCH_PASS;
if (!bossbenchUser || !bossbenchPass) throw new Error("Set BOSSBENCH_USER and BOSSBENCH_PASS before mounting Bossbench");
`
    : "";
}

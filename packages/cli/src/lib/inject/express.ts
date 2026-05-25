import { readFileSync } from "node:fs";

import type { InjectorInput, InjectorOutput } from "./hono.js";

export async function expressInjector({
  entry,
  mountPath,
  withAuth,
}: InjectorInput): Promise<InjectorOutput> {
  if (!entry)
    return { ok: false, path: null, source: "", reason: "No entry file found" };
  const src = readFileSync(entry, "utf8");
  if (src.includes("@bossbench/express") && src.includes("bossbench("))
    return { ok: true, path: entry, source: src };
  if (!/export\s+default\s+app\s*;?/.test(src))
    return {
      ok: false,
      path: null,
      source: "",
      reason: "No supported app export found",
    };
  const authSetup = withAuth
    ? `const bossbenchUser = process.env.BOSSBENCH_USER;
const bossbenchPass = process.env.BOSSBENCH_PASS;
if (!bossbenchUser || !bossbenchPass) throw new Error("Set BOSSBENCH_USER and BOSSBENCH_PASS before mounting Bossbench");
`
    : "";
  const authOption = withAuth
    ? `  auth: { username: bossbenchUser, password: bossbenchPass },\n`
    : "";
  const snippet = `${authSetup}app.use(${JSON.stringify(mountPath)}, bossbench({\n  db: process.env.DATABASE_URL,\n  basePath: ${JSON.stringify(mountPath)},\n${authOption}  // TODO: pass a PgBoss instance as 'boss' for actions\n}));`;
  const out = `${src.includes(`import { bossbench } from "@bossbench/express";`) ? "" : `import { bossbench } from "@bossbench/express";\n`}${src.replace(/export\s+default\s+app\s*;?/, `${snippet}\n\nexport default app;`)}`;
  return { ok: true, path: entry, source: out };
}

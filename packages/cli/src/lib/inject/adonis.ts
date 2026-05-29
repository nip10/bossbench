import { existsSync, readFileSync } from "node:fs";
import type { InjectorOutput } from "./h3.js";

export async function adonisInjector({
  entry,
  mountPath,
  withAuth,
}: {
  cwd?: string;
  entry: string | null;
  mountPath: string;
  withAuth: boolean;
}): Promise<InjectorOutput> {
  if (!entry)
    return {
      ok: false,
      path: null,
      source: "",
      reason: "No start/routes.ts file found",
    };

  const source = existsSync(entry)
    ? readFileSync(entry, "utf8")
    : `import router from "@adonisjs/core/services/router";\n`;
  if (
    source.includes("@bossbench/adonis") &&
    source.includes("mountBossbench(")
  ) {
    return { ok: true, path: entry, source };
  }

  const importLines = `${source.includes("@bossbench/adonis") ? "" : `import { mountBossbench } from "@bossbench/adonis";\n`}${source.includes("@adonisjs/core/services/router") ? "" : `import router from "@adonisjs/core/services/router";\n`}`;
  const snippet = `${authGuard(withAuth)}mountBossbench(router, ${JSON.stringify(mountPath)}, {
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
`;

  return {
    ok: true,
    path: entry,
    source: `${importLines}${source}\n${snippet}`,
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

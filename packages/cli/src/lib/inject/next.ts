import { existsSync } from "node:fs";
import { join } from "node:path";
import type { InjectorOutput } from "./hono.js";

export async function nextInjector({
  cwd,
  mountPath,
  withAuth,
}: {
  cwd?: string;
  mountPath: string;
  withAuth: boolean;
}): Promise<InjectorOutput> {
  const appBase = cwd
    ? existsSync(join(cwd, "src/app"))
      ? "src/app"
      : existsSync(join(cwd, "app"))
        ? "app"
        : null
    : "app";
  if (!appBase) {
    return {
      ok: false,
      reason:
        "Detected Next.js Pages Router. Create app/ or src/app (App Router) before scaffolding the Bossbench route.",
      path: null,
      source: "",
    };
  }
  const target = `${cwd ?? "your app"}/${appBase}${mountPath}/[[...bossbench]]/route.ts`;
  return {
    ok: true,
    reason: `Detected Next.js. Scaffold ${target} with @bossbench/next.`,
    path: target,
    source: `import { bossbench } from "@bossbench/next";\n\n${withAuth ? authGuard() : ""}export const { GET, POST, PUT, PATCH, DELETE } = bossbench({\n  db: process.env.DATABASE_URL,\n  basePath: ${JSON.stringify(mountPath)},\n${withAuth ? `  auth: { username: bossbenchUser, password: bossbenchPass },\n` : `  allowUnauthenticated: true,\n`}});\n`,
  };
}

function authGuard() {
  return `const bossbenchUser = process.env.BOSSBENCH_USER;
const bossbenchPass = process.env.BOSSBENCH_PASS;
if (!bossbenchUser || !bossbenchPass) throw new Error("Set BOSSBENCH_USER and BOSSBENCH_PASS before mounting Bossbench");

`;
}

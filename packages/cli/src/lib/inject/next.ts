import { existsSync } from "node:fs";
import { join } from "node:path";
import type { InjectorOutput } from "./hono.js";

export async function nextInjector({
  cwd,
  mountPath,
}: {
  cwd?: string;
  mountPath: string;
}): Promise<InjectorOutput> {
  if (
    cwd &&
    !existsSync(join(cwd, "src/app")) &&
    !existsSync(join(cwd, "app"))
  ) {
    return {
      ok: false,
      reason:
        "Detected Next.js Pages Router. @bossbench/next will require App Router; create app/ or src/app before scaffolding the Bossbench route.",
      path: null,
      source: "",
    };
  }
  const appBase = cwd
    ? existsSync(join(cwd, "src/app"))
      ? "src/app"
      : "app"
    : "app";
  const target = `${cwd ?? "your app"}/${appBase}${mountPath}/[[...bossbench]]/route.ts`;
  return {
    ok: false,
    reason: `Detected Next.js. Scaffold ${target} with @bossbench/next (adapter package pending; issue #4).`,
    path: null,
    source: "",
  };
}

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const PACKAGES = [
  "@bossbench/core",
  "@bossbench/hono",
  "@bossbench/h3",
  "@bossbench/express",
  "@bossbench/fastify",
  "@bossbench/elysia",
  "@bossbench/next",
  "@bossbench/nestjs",
  "@bossbench/mcp",
  "@bossbench/cli",
] as const;

const DIST_CHECKS = [
  "packages/core/dist/index.js",
  "packages/hono/dist/index.js",
  "packages/h3/dist/index.js",
  "packages/express/dist/index.js",
  "packages/fastify/dist/index.js",
  "packages/elysia/dist/index.js",
  "packages/next/dist/index.js",
  "packages/nestjs/dist/index.js",
  "packages/mcp/dist/index.js",
  "apps/standalone/dist/index.js",
  "packages/cli/dist/index.js",
];

async function main() {
  console.log("[smoke] Bossbench smoke check");
  await ensureBuild();
  await verifyImports();
  await maybeSmokeDemo();
  console.log("[smoke] OK");
}

async function ensureBuild() {
  const missing = DIST_CHECKS.filter((file) => !existsSync(file));
  if (missing.length === 0) {
    console.log("[smoke] build artifacts present");
    return;
  }

  console.log(`[smoke] building missing packages: ${missing.length}`);
  for (const file of missing) {
    const target = buildTargetForDist(file);
    await run(["bun", "run", `--filter=${target}`, "build"], `build ${target}`);
  }
}

function buildTargetForDist(file: string) {
  if (file === "apps/standalone/dist/index.js") return "@bossbench/standalone";

  const match = file.match(/^packages\/([^/]+)\//);
  if (!match?.[1]) throw new Error(`No build target for ${file}`);
  return `@bossbench/${match[1]}`;
}

async function verifyImports() {
  console.log("[smoke] verifying package entrypoints");

  const [
    { BossbenchCore },
    { bossbench: honoBossbench },
    { bossbench: h3Bossbench },
    { bossbench: expressBossbench },
    { bossbench: fastifyBossbench },
    { bossbench: elysiaBossbench },
    { bossbench: nextBossbench },
    { bossbench: nestBossbench },
    { BossbenchClient },
  ] = await Promise.all([
    importPackage("packages/core/dist/index.js"),
    importPackage("packages/hono/dist/index.js"),
    importPackage("packages/h3/dist/index.js"),
    importPackage("packages/express/dist/index.js"),
    importPackage("packages/fastify/dist/index.js"),
    importPackage("packages/elysia/dist/index.js"),
    importPackage("packages/next/dist/index.js"),
    importPackage("packages/nestjs/dist/index.js"),
    importPackage("packages/mcp/dist/index.js"),
  ]);

  const options = {
    db: "postgres://postgres:postgres@localhost:54329/bossbench",
    allowUnauthenticated: true,
  };

  const core = BossbenchCore.create(options);
  if (!core.getConfig().title)
    throw new Error("@bossbench/core config missing title");
  if (!honoBossbench(options))
    throw new Error("@bossbench/hono failed to create app");
  if (!h3Bossbench(options))
    throw new Error("@bossbench/h3 failed to create handler");
  if (!expressBossbench(options))
    throw new Error("@bossbench/express failed to create router");
  if (!fastifyBossbench(options))
    throw new Error("@bossbench/fastify failed to create plugin");
  if (!elysiaBossbench(options))
    throw new Error("@bossbench/elysia failed to create handler");
  if (!nextBossbench(options))
    throw new Error("@bossbench/next failed to create route handlers");
  if (typeof nestBossbench !== "function")
    throw new Error("@bossbench/nestjs export missing");
  if (typeof BossbenchClient !== "function")
    throw new Error("@bossbench/mcp export missing");

  await nestBossbench(mockNestApp("express"), "/jobs", options);
  await nestBossbench(mockNestApp("fastify"), "/jobs", options);

  await run(["bun", "packages/cli/dist/index.js", "--help"], "cli --help");

  console.log(`  ✓ imported ${PACKAGES.length} packages`);
}

async function importPackage(relativePath: string) {
  return import(pathToFileURL(resolve(relativePath)).href);
}

async function maybeSmokeDemo() {
  const candidate =
    process.env.BOSSBENCH_SMOKE_DATABASE_URL ??
    (process.env.CI
      ? "postgres://postgres:postgres@localhost:54329/bossbench"
      : undefined);
  if (!candidate) {
    console.log(
      "[smoke] skipping demo checks (set BOSSBENCH_SMOKE_DATABASE_URL to enable)",
    );
    return;
  }

  const port = await getFreePort();

  const proc = spawn(
    "bun",
    ["run", "--filter=@bossbench/example-demo", "dev"],
    {
      env: { ...process.env, DATABASE_URL: candidate, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );

  const output: string[] = [];
  proc.stdout.on("data", (chunk) => output.push(chunk.toString()));
  proc.stderr.on("data", (chunk) => output.push(chunk.toString()));

  try {
    await waitForDemo(proc, output);
    const health = await fetch(`http://localhost:${port}/health`);
    if (!health.ok) throw new Error(`/health returned ${health.status}`);
    const config = await fetch(`http://localhost:${port}/jobs/api/config`, {
      headers: { authorization: basicAuth("admin", "change-me") },
    });
    if (!config.ok)
      throw new Error(`/jobs/api/config returned ${config.status}`);
    console.log("[smoke] demo endpoints reachable");
  } catch (error) {
    const message = String((error as Error).message ?? error);
    const canSkipUnavailableDb = !process.env.CI;
    if (
      canSkipUnavailableDb &&
      (message.includes("ECONNREFUSED") ||
        message.includes("connect") ||
        message.includes("postgres"))
    ) {
      console.log("[smoke] skipping demo checks (Postgres/Docker unavailable)");
      return;
    }
    throw error;
  } finally {
    await kill(proc);
  }
}

async function getFreePort() {
  return await new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      if (typeof address === "object" && address?.port) {
        const { port } = address;
        server.close(() => resolvePort(port));
      } else {
        server.close(() => reject(new Error("Could not allocate smoke port")));
      }
    });
  });
}

function basicAuth(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function mockNestApp(type: "express" | "fastify") {
  return {
    getHttpAdapter() {
      return type === "fastify"
        ? {
            getType: () => "fastify",
            getInstance: () => ({ register: async () => undefined }),
          }
        : { getType: () => "express" };
    },
    use() {
      return undefined;
    },
  } as never;
}

async function waitForDemo(proc: ReturnType<typeof spawn>, output: string[]) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (output.join("").match(/running at|listening on|Ready/i)) return;
    if (proc.exitCode !== null) throw new Error(output.join(""));
    await sleep(250);
  }
  throw new Error(`demo timed out\n${output.join("")}`);
}

async function run(command: string[], label: string) {
  await new Promise<void>((resolve, reject) => {
    const [cmd, ...args] = command;
    if (!cmd) throw new Error(`Missing command for ${label}`);
    const proc = spawn(cmd, args, { stdio: "inherit" });
    proc.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${label} exited with ${code}`)),
    );
    proc.on("error", reject);
  });
}

async function kill(proc: ReturnType<typeof spawn>) {
  if (proc.pid) {
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      proc.kill("SIGTERM");
    }
  }
  await sleep(1000);
}

await main().catch((error) => {
  console.error(`[smoke] failed: ${(error as Error).message}`);
  process.exit(1);
});

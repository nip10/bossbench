#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface InitOptions {
  dryRun?: boolean;
}

type Framework = "hono" | "express" | "unknown";
type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

const ENTRY_CANDIDATES = [
  "src/index.ts",
  "src/server.ts",
  "src/app.ts",
  "index.ts",
  "server.ts",
  "app.ts",
];

export async function initCommand(cwd = ".", options: InitOptions = {}) {
  const pkgPath = join(cwd, "package.json");
  const pkg = readJson(pkgPath);
  const packageManager = detectPackageManager(cwd);
  const framework = detectFramework(pkg);
  const envPath = join(cwd, ".env.example");
  const entryPath = findEntryPath(cwd);
  const installCommand = getInstallCommand(packageManager, framework);
  const envContents = nextEnvContents(safeText(envPath));
  const nextPackageJson =
    framework === "unknown" ? pkg : withDependencies(pkg, framework);
  const nextEntry =
    entryPath && framework !== "unknown"
      ? injectMount(readFileSync(entryPath, "utf8"), framework)
      : undefined;

  if (!options.dryRun) {
    await writeFile(envPath, envContents);
    if (framework !== "unknown") {
      await writeFile(pkgPath, `${JSON.stringify(nextPackageJson, null, 2)}\n`);
    }
    if (entryPath && nextEntry) await writeFile(entryPath, nextEntry);
  }

  return {
    packageManager,
    framework,
    envPath,
    entryPath,
    entryUpdated: Boolean(nextEntry),
    installCommand,
    dryRun: options.dryRun === true,
  };
}

function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(join(cwd, "bun.lock"))) return "bun";
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

function detectFramework(pkg: PackageJson): Framework {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.hono) return "hono";
  if (deps.express) return "express";
  return "unknown";
}

function withDependencies(
  pkg: PackageJson,
  framework: Exclude<Framework, "unknown">,
): PackageJson {
  return {
    ...pkg,
    dependencies: {
      ...pkg.dependencies,
      [framework === "hono" ? "@bossbench/hono" : "@bossbench/express"]:
        "latest",
      pg: pkg.dependencies?.pg ?? "^8.13.1",
      "pg-boss": pkg.dependencies?.["pg-boss"] ?? "^12.18.2",
    },
  };
}

function nextEnvContents(existing: string | undefined) {
  const lines = new Set((existing ?? "").split(/\r?\n/).filter(Boolean));
  lines.add("BOSSBENCH_USER=admin");
  lines.add("BOSSBENCH_PASS=change-me");
  lines.add("DATABASE_URL=postgres://localhost:5432/postgres");
  return `${[...lines].join("\n")}\n`;
}

function findEntryPath(cwd: string) {
  return ENTRY_CANDIDATES.map((candidate) => join(cwd, candidate)).find(
    (path) => existsSync(path),
  );
}

function injectMount(source: string, framework: Exclude<Framework, "unknown">) {
  if (source.includes("bossbench({")) return source;
  if (!/export\s+default\s+app\s*;?/.test(source)) return undefined;
  const packageName =
    framework === "hono" ? "@bossbench/hono" : "@bossbench/express";
  const importLine = `import { bossbench } from "${packageName}";`;
  const mount = framework === "hono" ? honoMount() : expressMount();
  const withImport = source.includes(importLine)
    ? source
    : `${importLine}\n${source}`;

  return withImport.replace(
    /export\s+default\s+app\s*;?/,
    `${mount}\n\nexport default app;`,
  );
}

function honoMount() {
  return `app.route("/jobs", bossbench({
  db: process.env.DATABASE_URL!,
  basePath: "/jobs",
  auth: {
    username: process.env.BOSSBENCH_USER!,
    password: process.env.BOSSBENCH_PASS!,
  },
}));`;
}

function expressMount() {
  return `app.use("/jobs", bossbench({
  db: process.env.DATABASE_URL!,
  basePath: "/jobs",
  auth: {
    username: process.env.BOSSBENCH_USER!,
    password: process.env.BOSSBENCH_PASS!,
  },
}));`;
}

function getInstallCommand(
  packageManager: PackageManager,
  framework: Framework,
) {
  const adapter =
    framework === "hono"
      ? "@bossbench/hono"
      : framework === "express"
        ? "@bossbench/express"
        : "@bossbench/hono";
  const packages = `${adapter} pg pg-boss`;
  switch (packageManager) {
    case "bun":
      return `bun add ${packages}`;
    case "pnpm":
      return `pnpm add ${packages}`;
    case "yarn":
      return `yarn add ${packages}`;
    case "npm":
      return `npm install ${packages}`;
  }
}

function readJson(path: string): PackageJson {
  const text = safeText(path);
  return text ? JSON.parse(text) : {};
}

function safeText(path: string) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] ?? "init";
  const dryRun = process.argv.includes("--dry-run");
  if (command !== "init") {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
  const result = await initCommand(process.cwd(), { dryRun });
  console.log(
    `Bossbench initialized (${result.framework}, ${result.packageManager}).`,
  );
  console.log(`Updated ${result.envPath}`);
  if (result.entryPath) console.log(`Updated ${result.entryPath}`);
  if (result.entryPath && !result.entryUpdated) {
    console.log(
      "Entry file detected but no supported export default app pattern was found; add the /jobs mount manually.",
    );
  }
  console.log(`Install command: ${result.installCommand}`);
}

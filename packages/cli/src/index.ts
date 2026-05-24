#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function initCommand(cwd = ".") {
  const pkg = readJson(join(cwd, "package.json"));
  const packageManager = detectPackageManager(cwd);
  const framework = detectFramework(pkg);
  const envPath = join(cwd, ".env.example");
  const existing = safeText(envPath);
  const lines = new Set((existing ?? "").split(/\r?\n/).filter(Boolean));

  lines.add("BOSSBENCH_USER=admin");
  lines.add("BOSSBENCH_PASS=change-me");
  lines.add("DATABASE_URL=postgres://localhost:5432/postgres");

  await writeFile(envPath, `${[...lines].join("\n")}\n`);

  return { packageManager, framework, envPath };
}

function detectPackageManager(cwd: string) {
  if (existsSync(join(cwd, "bun.lock"))) return "bun";
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function detectFramework(pkg: PackageJson) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.hono) return "hono";
  if (deps.express) return "express";
  return "unknown";
}

function readJson(path: string) {
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
  if (command !== "init") {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
  const result = await initCommand(process.cwd());
  console.log(
    `Bossbench initialized (${result.framework}, ${result.packageManager}).`,
  );
  console.log(`Updated ${result.envPath}`);
}

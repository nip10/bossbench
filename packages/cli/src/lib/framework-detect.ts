import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fg from "fast-glob";

export type Framework =
  | "hono"
  | "h3"
  | "nuxt"
  | "adonis"
  | "tanstack-start"
  | "express"
  | "fastify"
  | "elysia"
  | "nestjs"
  | "next";
export interface DetectionResult {
  framework: Framework;
  entry: string | null;
  adapterPackage: string;
}
const PKG: Record<Framework, string> = {
  hono: "hono",
  h3: "h3",
  nuxt: "nuxt",
  adonis: "@adonisjs/core",
  "tanstack-start": "@tanstack/react-start",
  express: "express",
  fastify: "fastify",
  elysia: "elysia",
  nestjs: "@nestjs/core",
  next: "next",
};
const ADAPTER: Record<Framework, string> = {
  hono: "@bossbench/hono",
  h3: "@bossbench/h3",
  nuxt: "@bossbench/nuxt",
  adonis: "@bossbench/adonis",
  "tanstack-start": "@bossbench/tanstack-start",
  express: "@bossbench/express",
  fastify: "@bossbench/fastify",
  elysia: "@bossbench/elysia",
  nestjs: "@bossbench/nestjs",
  next: "@bossbench/next",
};
const ORDER: Framework[] = [
  "next",
  "nuxt",
  "tanstack-start",
  "adonis",
  "nestjs",
  "elysia",
  "fastify",
  "express",
  "h3",
  "hono",
];

export async function detectFramework(
  cwd: string,
  deps: Record<string, string>,
): Promise<DetectionResult | null> {
  for (const framework of ORDER) {
    if (!deps[PKG[framework]]) continue;
    if (framework === "next") {
      if (await hasNextDir(cwd))
        return { framework, entry: null, adapterPackage: ADAPTER[framework] };
      continue;
    }
    if (framework === "nuxt") {
      if (hasNuxtConfig(cwd))
        return { framework, entry: null, adapterPackage: ADAPTER[framework] };
      continue;
    }
    if (framework === "adonis") {
      const entry = adonisEntry(cwd);
      if (entry)
        return { framework, entry, adapterPackage: ADAPTER[framework] };
      continue;
    }
    const entry = await findEntry(cwd, framework);
    if (entry) return { framework, entry, adapterPackage: ADAPTER[framework] };
  }
  return null;
}

async function hasNextDir(cwd: string) {
  return ["app", "src/app", "pages", "src/pages"].some((p) =>
    existsSync(join(cwd, p)),
  );
}

function hasNuxtConfig(cwd: string) {
  return ["nuxt.config.ts", "nuxt.config.js", "nuxt.config.mjs"].some((p) =>
    existsSync(join(cwd, p)),
  );
}

function adonisEntry(cwd: string) {
  const entry = join(cwd, "start/routes.ts");
  if (existsSync(entry)) return entry;
  return ["adonisrc.ts", "adonisrc.js", ".adonisrc.json"].some((p) =>
    existsSync(join(cwd, p)),
  )
    ? entry
    : null;
}

async function findEntry(
  cwd: string,
  framework: Exclude<Framework, "next" | "nuxt" | "adonis">,
) {
  const regex =
    framework === "hono"
      ? /new\s+Hono\s*\(/
      : framework === "h3"
        ? /createApp\s*\(/
        : framework === "tanstack-start"
          ? /tanstackStart\s*\(|createFileRoute\s*\(/
          : framework === "express"
            ? /express\s*\(/
            : framework === "fastify"
              ? /(?:\bfastify\s*\(|\bFastify\s*\()/
              : framework === "elysia"
                ? /new\s+Elysia\s*\(/
                : /NestFactory\s*\.\s*create\s*\(/;
  const files = await fg(
    [
      "src/**/*.{ts,tsx,js,mjs}",
      "app/**/*.{ts,tsx,js,mjs}",
      "index.{ts,js}",
      "main.{ts,js}",
    ],
    {
      cwd,
      absolute: true,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    },
  );
  for (const file of files)
    if (regex.test(await readFile(file, "utf8"))) return file;
  return null;
}

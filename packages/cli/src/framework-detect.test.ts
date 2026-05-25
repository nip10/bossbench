import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectFramework } from "./lib/framework-detect.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  dirs.length = 0;
});

describe("detectFramework", () => {
  it.each([
    ["hono", { hono: "^4" }, `import { Hono } from "hono";\nnew Hono();`],
    [
      "express",
      { express: "^4" },
      `import express from "express";\nexpress();`,
    ],
    [
      "fastify",
      { fastify: "^5" },
      `import fastify from "fastify";\nfastify();`,
    ],
    [
      "elysia",
      { elysia: "^1" },
      `import { Elysia } from "elysia";\nnew Elysia();`,
    ],
    ["next", { next: "^15" }, null],
    [
      "nestjs",
      { "@nestjs/core": "^10" },
      `import { NestFactory } from "@nestjs/core";\nNestFactory.create(AppModule);`,
    ],
    [
      "fastify",
      { fastify: "^4" },
      `import Fastify from "fastify";\nconst app = fastify();`,
    ],
    [
      "elysia",
      { elysia: "^1" },
      `import { Elysia } from "elysia";\nnew Elysia();`,
    ],
  ])("detects %s", async (framework, dependencies, entry) => {
    const cwd = await mkdtemp(join(tmpdir(), "bossbench-detect-"));
    dirs.push(cwd);
    if (framework === "next")
      await mkdir(join(cwd, "app"), { recursive: true });
    else {
      await mkdir(join(cwd, "src"));
      if (entry) await writeFile(join(cwd, "src/index.ts"), entry);
    }
    const result = await detectFramework(
      cwd,
      dependencies as Record<string, string>,
    );
    expect(result?.framework).toBe(framework);
  });
});

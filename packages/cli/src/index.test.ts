import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { init } from "./commands/init.js";

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("init", () => {
  it("supports dry runs without writing files", async () => {
    const cwd = await fixture({
      dependencies: { hono: "^4.0.0" },
      entry: `import { Hono } from "hono";\nconst app = new Hono();\nexport default app;\n`,
    });
    const before = await readFile(join(cwd, "src/index.ts"), "utf8");
    await init({
      cwd,
      mount: "/jobs",
      auth: true,
      docker: true,
      yes: true,
      dryRun: true,
    });
    const after = await readFile(join(cwd, "src/index.ts"), "utf8");
    expect(after).toBe(before);
  });

  it("does not duplicate env keys or overwrite docker compose", async () => {
    const cwd = await fixture({
      dependencies: { hono: "^4.0.0" },
      entry: `import { Hono } from "hono";\nconst app = new Hono();\nexport default app;\n`,
    });
    await writeFile(
      join(cwd, ".env.example"),
      "# existing config\nDATABASE_URL=custom\nBOSSBENCH_USER=alice\nBOSSBENCH_PASS=secret\nCUSTOM_lower=value\n",
    );
    await writeFile(join(cwd, "docker-compose.yml"), "existing: true\n");
    await init({
      cwd,
      mount: "/jobs",
      auth: true,
      docker: true,
      yes: true,
      dryRun: false,
    });
    const env = await readFile(join(cwd, ".env.example"), "utf8");
    const compose = await readFile(join(cwd, "docker-compose.yml"), "utf8");
    expect(env.match(/^DATABASE_URL=/gm)?.length).toBe(1);
    expect(env.match(/^BOSSBENCH_USER=/gm)?.length).toBe(1);
    expect(env.match(/^BOSSBENCH_PASS=/gm)?.length).toBe(1);
    expect(env).toContain("# existing config");
    expect(env).toContain("CUSTOM_lower=value");
    expect(compose).toContain("existing: true");
  });

  it("does not half-inject unsupported entry files", async () => {
    const cwd = await fixture({
      dependencies: { express: "^4.0.0" },
      entry: `import express from "express";\nconst app = express();\napp.listen(3000);\n`,
    });
    await init({
      cwd,
      mount: "/jobs",
      auth: true,
      docker: true,
      yes: true,
      dryRun: false,
    });
    const entry = await readFile(join(cwd, "src/index.ts"), "utf8");
    expect(entry).not.toContain("@bossbench/express");
  });

  it("prints install commands for available adapter packages", async () => {
    const cwd = await fixture({
      dependencies: { fastify: "^5.0.0" },
      entry: `import fastify from "fastify";\nconst app = fastify();\nexport default app;\n`,
    });

    const result = await init({
      cwd,
      mount: "/jobs",
      auth: true,
      docker: false,
      yes: true,
      dryRun: true,
    });

    expect(result?.framework).toBe("fastify");
    expect(result?.install).toContain("npm add @bossbench/fastify");
  });

  it("prints install commands for h3 projects", async () => {
    const cwd = await fixture({
      dependencies: { h3: "^1.0.0" },
      entry: `import { createApp } from "h3";\nconst app = createApp();\nexport default app;\n`,
    });

    const result = await init({
      cwd,
      mount: "/jobs",
      auth: true,
      docker: false,
      yes: true,
      dryRun: true,
    });

    expect(result?.framework).toBe("h3");
    expect(result?.install).toContain("npm add @bossbench/h3 pg pg-boss");
  });

  it("includes a default Nest platform adapter in install guidance", async () => {
    const cwd = await fixture({
      dependencies: { "@nestjs/core": "^10.0.0" },
      entry: `import { NestFactory } from "@nestjs/core";\nconst app = await NestFactory.create(AppModule);\nawait app.listen(3000);\n`,
    });

    const result = await init({
      cwd,
      mount: "/jobs",
      auth: true,
      docker: false,
      yes: true,
      dryRun: true,
    });

    expect(result?.framework).toBe("nestjs");
    expect(result?.install).toContain(
      "@bossbench/nestjs @bossbench/express @bossbench/fastify",
    );
  });
});

async function fixture({
  dependencies,
  entry,
}: {
  dependencies: Record<string, string>;
  entry: string;
}) {
  const cwd = await mkdtemp(join(tmpdir(), "bossbench-cli-"));
  tempDirs.push(cwd);
  await mkdir(join(cwd, "src"));
  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({ type: "module", dependencies }, null, 2),
  );
  await writeFile(join(cwd, "src/index.ts"), entry);
  return cwd;
}

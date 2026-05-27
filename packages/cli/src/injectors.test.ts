import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { expressInjector } from "./lib/inject/express.js";
import { h3Injector } from "./lib/inject/h3.js";
import { honoInjector } from "./lib/inject/hono.js";
import { INJECTORS } from "./lib/inject/index.js";
import { nextInjector } from "./lib/inject/next.js";
import { detectPackageManager } from "./lib/package-manager.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  dirs.length = 0;
});

describe("injectors", () => {
  it("injects Hono mount", async () => {
    const entry = await appFixture(
      `import { Hono } from "hono";\nconst app = new Hono();\nexport default app;\n`,
    );
    const result = await honoInjector({
      entry,
      mountPath: "/jobs",
      withAuth: true,
    });
    expect(result.ok).toBe(true);
    expect(result.source).toContain(
      `import { bossbench } from "@bossbench/hono";`,
    );
    expect(result.source).toContain(`app.route("/jobs", bossbench({`);
    expect(result.source).not.toContain("change-me");
    expect(result.source).toContain("throw new Error");
    expect(result.source).not.toContain("DATABASE_URL!");
  });

  it("injects h3 mount", async () => {
    const entry = await appFixture(
      `import { createApp } from "h3";\nconst app = createApp();\nexport default app;\n`,
    );
    const result = await h3Injector({
      entry,
      mountPath: "/jobs",
      withAuth: false,
    });
    expect(result.ok).toBe(true);
    expect(result.source).toContain(
      `import { bossbench } from "@bossbench/h3";`,
    );
    expect(result.source).toContain(`const bossbenchHandler = bossbench({`);
    expect(result.source).toContain(`app.use("/jobs", bossbenchHandler);`);
    expect(result.source).toContain(`app.use("/jobs/**", bossbenchHandler);`);
    expect(result.source).toContain(`allowUnauthenticated: true`);
  });

  it("injects Express mount", async () => {
    const entry = await appFixture(
      `import express from "express";\nconst app = express();\nexport default app;\n`,
    );
    const result = await expressInjector({
      entry,
      mountPath: "/jobs",
      withAuth: false,
    });
    expect(result.ok).toBe(true);
    expect(result.source).toContain(
      `import { bossbench } from "@bossbench/express";`,
    );
    expect(result.source).toContain(`basePath: "/jobs"`);
    expect(result.source).not.toContain("change-me");
    expect(result.source).not.toContain("DATABASE_URL!");
  });

  it("injects a mount when the import already exists", async () => {
    const entry = await appFixture(
      `import { Hono } from "hono";\nimport { bossbench } from "@bossbench/hono";\nconst app = new Hono();\nexport default app;\n`,
    );
    const result = await honoInjector({
      entry,
      mountPath: "/jobs",
      withAuth: true,
    });

    expect(result.ok).toBe(true);
    expect(result.source).toContain(`app.route("/jobs", bossbench({`);
    expect(result.source.match(/@bossbench\/hono/g)?.length).toBe(1);
  });

  it("returns a Next.js scaffold", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bossbench-next-"));
    dirs.push(cwd);
    await mkdir(join(cwd, "src/app"), { recursive: true });
    const result = await nextInjector({
      cwd,
      mountPath: "/jobs",
      withAuth: true,
    });
    expect(result.ok).toBe(true);
    expect(result.path).toContain("src/app/jobs/[[...bossbench]]/route.ts");
    expect(result.source).toContain(
      `export const { GET, POST, PUT, PATCH, DELETE } = bossbench(`,
    );
  });

  it("warns Pages Router projects that App Router is required", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bossbench-next-pages-"));
    dirs.push(cwd);
    await mkdir(join(cwd, "src/pages"), { recursive: true });

    const result = await nextInjector({
      cwd,
      mountPath: "/jobs",
      withAuth: true,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Pages Router");
    expect(result.reason).toContain("App Router");
  });

  it("generates live framework injectors", async () => {
    for (const framework of ["fastify", "elysia", "nestjs", "h3"] as const) {
      const entry = await appFixture(
        `const app = {} as any;\nexport default app;\n`,
      );
      const result = await INJECTORS[framework]({
        cwd: entry.replace(/\/src\/index\.ts$/, ""),
        entry,
        mountPath: "/jobs",
        withAuth: true,
      });
      expect(result.ok).toBe(true);
      expect(result.source).toContain(`basePath: "/jobs"`);
      expect(result.source).toContain(`process.env.BOSSBENCH_USER`);
    }
  });

  it("can scaffold unauthenticated snippets", async () => {
    const entry = await appFixture(
      `const app = {} as any;\nexport default app;\n`,
    );
    const result = await INJECTORS.fastify({
      cwd: entry.replace(/\/src\/index\.ts$/, ""),
      entry,
      mountPath: "/jobs",
      withAuth: false,
    });
    expect(result.source).toContain(`allowUnauthenticated: true`);
  });

  it("scaffolds Next route files with auth when requested", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bossbench-next-auth-"));
    dirs.push(cwd);
    await mkdir(join(cwd, "app"), { recursive: true });

    const result = await nextInjector({
      cwd,
      mountPath: "/jobs",
      withAuth: true,
    });

    expect(result.ok).toBe(true);
    expect(result.source).toContain("BOSSBENCH_USER");
    expect(result.source).not.toContain("allowUnauthenticated: true");
  });
});

describe("package manager detection", () => {
  it("detects bun, pnpm, yarn, and npm", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bossbench-pm-"));
    dirs.push(cwd);
    await writeFile(join(cwd, "bun.lock"), "");
    expect(detectPackageManager(cwd)).toBe("bun");
    await rm(join(cwd, "bun.lock"));
    await writeFile(join(cwd, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(cwd)).toBe("pnpm");
    await rm(join(cwd, "pnpm-lock.yaml"));
    await writeFile(join(cwd, "yarn.lock"), "");
    expect(detectPackageManager(cwd)).toBe("yarn");
    await rm(join(cwd, "yarn.lock"));
    expect(detectPackageManager(cwd)).toBe("npm");
  });
});

async function appFixture(entryText: string) {
  const cwd = await mkdtemp(join(tmpdir(), "bossbench-inject-"));
  dirs.push(cwd);
  await mkdir(join(cwd, "src"));
  const entry = join(cwd, "src/index.ts");
  await writeFile(entry, entryText);
  return entry;
}

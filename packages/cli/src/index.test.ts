import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initCommand } from "./index";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("initCommand", () => {
  it("injects Bossbench into a Hono app", async () => {
    const cwd = await fixture({
      dependencies: { hono: "^4.0.0" },
      entry: `import { Hono } from "hono";\nconst app = new Hono();\nexport default app;\n`,
    });

    const result = await initCommand(cwd);
    const pkg = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
    const entry = await readFile(join(cwd, "src/index.ts"), "utf8");

    expect(result.framework).toBe("hono");
    expect(result.entryPath).toBe(join(cwd, "src/index.ts"));
    expect(result.entryUpdated).toBe(true);
    expect(pkg.dependencies).toMatchObject({
      "@bossbench/hono": "latest",
      pg: "^8.13.1",
      "pg-boss": "^12.18.2",
    });
    expect(entry).toContain(`import { bossbench } from "@bossbench/hono";`);
    expect(entry).toContain(`app.route("/jobs", bossbench({`);
    expect(entry).toContain(`basePath: "/jobs"`);
  });

  it("injects Bossbench into an Express app", async () => {
    const cwd = await fixture({
      dependencies: { express: "^4.0.0" },
      entry: `import express from "express";\nconst app = express();\nexport default app;\n`,
    });

    const result = await initCommand(cwd);
    const entry = await readFile(join(cwd, "src/index.ts"), "utf8");

    expect(result.framework).toBe("express");
    expect(entry).toContain(`import { bossbench } from "@bossbench/express";`);
    expect(entry).toContain(`app.use("/jobs", bossbench({`);
  });

  it("supports dry runs without writing files", async () => {
    const cwd = await fixture({
      dependencies: { hono: "^4.0.0" },
      entry: `import { Hono } from "hono";\nconst app = new Hono();\nexport default app;\n`,
    });
    const before = await readFile(join(cwd, "src/index.ts"), "utf8");

    const result = await initCommand(cwd, { dryRun: true });
    const after = await readFile(join(cwd, "src/index.ts"), "utf8");

    expect(result.dryRun).toBe(true);
    expect(after).toBe(before);
  });

  it("does not half-inject imports when no supported app export is found", async () => {
    const cwd = await fixture({
      dependencies: { express: "^4.0.0" },
      entry: `import express from "express";\nconst app = express();\napp.listen(3000);\n`,
    });

    const result = await initCommand(cwd);
    const entry = await readFile(join(cwd, "src/index.ts"), "utf8");

    expect(result.entryUpdated).toBe(false);
    expect(entry).not.toContain("@bossbench/express");
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

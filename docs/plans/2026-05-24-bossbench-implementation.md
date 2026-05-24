# Bossbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Bossbench, a pg-boss-native embedded dashboard with Hono and Express adapters, a SQL-backed read model, pg-boss-backed actions, CLI installer, examples, and a simple marketing/docs site.

**Architecture:** Use a Bun/Turbo TypeScript monorepo inspired by Workbench's package shape. `@bossbench/core` owns typed domain models, Postgres repository reads, pg-boss action service, Hono API routes, and the bundled React UI. `@bossbench/hono` and `@bossbench/express` adapt the core into framework-specific mounted apps/routers.

**Tech Stack:** Bun, TypeScript, Turbo, Biome, tsup, Vite, React, Hono, Express, pg, pg-boss, Vitest, Testcontainers or Docker-backed Postgres integration tests.

---

## Prerequisites and constraints

- Current workspace: `/Users/dc/dev/bossbench`.
- The workspace currently has no git repository. If implementation needs commits, initialize git or move this plan into the intended repository before starting.
- Approved design: `docs/plans/2026-05-24-bossbench-design.md`.
- Use TDD for core behavior: write failing tests first, run them, implement minimal code, rerun.
- Keep v1 pg-boss-native. Do not introduce BullMQ compatibility shims.
- Avoid implementing unsupported pg-boss concepts such as flows/DAGs, queue pause/unpause, or durable cluster-wide worker registry.

## Task 1: Initialize the monorepo skeleton

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `biome.json`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: Write the root package manifest**

Create `package.json`:

```json
{
  "name": "bossbench-monorepo",
  "private": true,
  "version": "0.0.0",
  "description": "Open-source pg-boss dashboard. Drop-in for modern Node backends.",
  "workspaces": [
    "apps/*",
    "packages/*",
    "examples/*"
  ],
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev --parallel",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.10",
    "turbo": "^2.3.0",
    "typescript": "^5.7.2"
  },
  "packageManager": "bun@1.3.11",
  "engines": {
    "node": ">=18"
  }
}
```

**Step 2: Add build orchestration**

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

**Step 3: Add shared TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Step 4: Add formatter/linter config**

Create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.10/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always"
    }
  }
}
```

**Step 5: Add ignore file and README**

Create `.gitignore`:

```gitignore
node_modules
dist
.turbo
.next
coverage
.env
.env.local
*.log
```

Create `README.md`:

```md
# Bossbench

Open-source pg-boss dashboard. Drop-in for modern Node backends.

Bossbench provides queue, job, schedule, warning, dead-letter, and metrics views for pg-boss. It reads dashboard data from Postgres and uses a pg-boss instance for safe mutations.

## Packages

- `@bossbench/core`
- `@bossbench/hono`
- `@bossbench/express`
- `@bossbench/cli`

## Development

```bash
bun install
bun run build
bun run typecheck
bun run test
```
```

**Step 6: Install dependencies**

Run: `bun install`

Expected: lockfile created and root dependencies installed.

**Step 7: Verify root scripts resolve**

Run: `bun run lint`

Expected: PASS or only formatting warnings in newly created files.

**Step 8: Commit**

```bash
git add package.json turbo.json tsconfig.base.json biome.json .gitignore README.md bun.lock
git commit -m "chore: initialize bossbench monorepo"
```

## Task 2: Create core package scaffold

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/vite.config.ts`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/env.d.ts`
- Create: `packages/core/src/ui/index.html`
- Create: `packages/core/src/ui/main.tsx`

**Step 1: Create package manifest**

Create `packages/core/package.json`:

```json
{
  "name": "@bossbench/core",
  "version": "0.1.0",
  "description": "Core of Bossbench — pg-boss dashboard API, repository, actions, and bundled UI.",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "bun run build:ui && bun run build:lib",
    "build:lib": "tsup",
    "build:ui": "vite build",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@hono/zod-validator": "^0.7.0",
    "@tanstack/react-query": "^5.95.2",
    "@tanstack/react-router": "^1.168.4",
    "date-fns": "^4.1.0",
    "hono": "^4.6.14",
    "lru-cache": "^11.2.7",
    "pg": "^8.13.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@types/pg": "^8.11.10",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "pg-boss": "^12.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  },
  "peerDependencies": {
    "pg": ">=8.0.0",
    "pg-boss": ">=10.0.0"
  }
}
```

**Step 2: Add TypeScript config**

Create `packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts", "tsup.config.ts"]
}
```

**Step 3: Add build configs**

Create `packages/core/tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: false,
  external: ["pg", "pg-boss", "hono"],
});
```

Create `packages/core/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/ui",
    emptyOutDir: false,
  },
});
```

Create `packages/core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

**Step 4: Add entrypoints and placeholder UI**

Create `packages/core/src/index.ts`:

```ts
export const UI_DIST_PATH = new URL("../dist/ui", import.meta.url).pathname;

export type { BossbenchOptions } from "./core/types";
```

Create `packages/core/src/env.d.ts`:

```ts
/// <reference types="vite/client" />
```

Create `packages/core/src/ui/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bossbench</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/ui/main.tsx"></script>
  </body>
</html>
```

Create `packages/core/src/ui/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";

function App() {
  return <main>Bossbench</main>;
}

createRoot(document.getElementById("root")!).render(<App />);
```

**Step 5: Run checks**

Run: `bun run --filter=@bossbench/core typecheck`

Expected: FAIL because `./core/types` does not exist yet.

**Step 6: Commit after Task 3 instead**

Do not commit this broken scaffold yet. Continue to Task 3 to add core types.

## Task 3: Add core domain types and option normalization

**Files:**
- Create: `packages/core/src/core/types.ts`
- Create: `packages/core/src/core/options.ts`
- Create: `packages/core/src/core/options.test.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Write failing option tests**

Create `packages/core/src/core/options.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeOptions } from "./options";

describe("normalizeOptions", () => {
  it("defaults schema, title, readonly, and tags", () => {
    const options = normalizeOptions({ db: "postgres://example" });

    expect(options.schema).toBe("pgboss");
    expect(options.title).toBe("Bossbench");
    expect(options.readonly).toBe(false);
    expect(options.tags).toEqual([]);
  });

  it("requires either db or boss", () => {
    expect(() => normalizeOptions({})).toThrow("Bossbench requires a db connection or a pg-boss instance");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter=@bossbench/core test -- src/core/options.test.ts`

Expected: FAIL with missing `./options` module.

**Step 3: Add domain types**

Create `packages/core/src/core/types.ts`:

```ts
import type PgBoss from "pg-boss";
import type { Client, Pool } from "pg";

export type BossbenchDb = string | Pool | Client;

export type BossbenchJobState =
  | "created"
  | "retry"
  | "active"
  | "completed"
  | "cancelled"
  | "failed";

export interface BossbenchAuthOptions {
  username: string;
  password: string;
}

export interface BossbenchOptions {
  boss?: PgBoss;
  db?: BossbenchDb;
  schema?: string;
  auth?: BossbenchAuthOptions;
  title?: string;
  logo?: string;
  basePath?: string;
  readonly?: boolean;
  tags?: string[];
}

export type NormalizedBossbenchOptions = Required<
  Pick<BossbenchOptions, "schema" | "title" | "readonly" | "tags">
> &
  Omit<BossbenchOptions, "schema" | "title" | "readonly" | "tags">;

export interface QueueInfo {
  name: string;
  policy?: string | null;
  counts: Record<BossbenchJobState, number>;
}

export interface JobSummary {
  id: string;
  name: string;
  state: BossbenchJobState;
  priority: number;
  createdOn: string;
  startedOn?: string | null;
  completedOn?: string | null;
  retryCount?: number | null;
  retryLimit?: number | null;
  tags?: Record<string, unknown>;
}

export interface JobDetail extends JobSummary {
  data: unknown;
  output?: unknown;
  deadLetter?: string | null;
  policy?: string | null;
  error?: unknown;
  raw: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface JobFilters {
  queue?: string;
  state?: BossbenchJobState;
  q?: string;
  from?: string;
  to?: string;
  tags?: Record<string, string>;
  sort?: string;
  limit: number;
  offset: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

**Step 4: Add option normalization**

Create `packages/core/src/core/options.ts`:

```ts
import type { BossbenchOptions, NormalizedBossbenchOptions } from "./types";

export function normalizeOptions(options: BossbenchOptions): NormalizedBossbenchOptions {
  if (!options.db && !options.boss) {
    throw new Error("Bossbench requires a db connection or a pg-boss instance");
  }

  return {
    ...options,
    schema: options.schema ?? "pgboss",
    title: options.title ?? "Bossbench",
    readonly: options.readonly ?? false,
    tags: options.tags ?? [],
  };
}
```

**Step 5: Export types and helpers**

Modify `packages/core/src/index.ts`:

```ts
export const UI_DIST_PATH = new URL("../dist/ui", import.meta.url).pathname;

export { normalizeOptions } from "./core/options";
export type {
  ApiErrorBody,
  BossbenchDb,
  BossbenchJobState,
  BossbenchOptions,
  JobDetail,
  JobFilters,
  JobSummary,
  NormalizedBossbenchOptions,
  PaginatedResponse,
  QueueInfo,
} from "./core/types";
```

**Step 6: Run tests**

Run: `bun run --filter=@bossbench/core test -- src/core/options.test.ts`

Expected: PASS.

**Step 7: Run typecheck**

Run: `bun run --filter=@bossbench/core typecheck`

Expected: PASS.

**Step 8: Commit**

```bash
git add packages/core package.json bun.lock
git commit -m "feat: scaffold core package"
```

## Task 4: Add safe schema identifier utilities

**Files:**
- Create: `packages/core/src/db/identifiers.ts`
- Create: `packages/core/src/db/identifiers.test.ts`

**Step 1: Write failing tests**

Create `packages/core/src/db/identifiers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { quoteIdentifier, quoteQualifiedTable } from "./identifiers";

describe("quoteIdentifier", () => {
  it("quotes simple identifiers", () => {
    expect(quoteIdentifier("pgboss")).toBe('"pgboss"');
  });

  it("rejects unsafe identifiers", () => {
    expect(() => quoteIdentifier("pgboss; drop schema public cascade")).toThrow("Invalid Postgres identifier");
    expect(() => quoteIdentifier("pgboss.job")).toThrow("Invalid Postgres identifier");
  });
});

describe("quoteQualifiedTable", () => {
  it("quotes schema and table", () => {
    expect(quoteQualifiedTable("pgboss", "job")).toBe('"pgboss"."job"');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter=@bossbench/core test -- src/db/identifiers.test.ts`

Expected: FAIL with missing module.

**Step 3: Implement identifier utilities**

Create `packages/core/src/db/identifiers.ts`:

```ts
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function quoteIdentifier(identifier: string): string {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid Postgres identifier: ${identifier}`);
  }

  return `"${identifier.replaceAll('"', '""')}"`;
}

export function quoteQualifiedTable(schema: string, table: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}
```

**Step 4: Run tests**

Run: `bun run --filter=@bossbench/core test -- src/db/identifiers.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/core/src/db/identifiers.ts packages/core/src/db/identifiers.test.ts
git commit -m "feat: add safe postgres identifiers"
```

## Task 5: Add Postgres client factory

**Files:**
- Create: `packages/core/src/db/client.ts`
- Create: `packages/core/src/db/client.test.ts`

**Step 1: Write failing tests**

Create `packages/core/src/db/client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDbClient } from "./client";

describe("createDbClient", () => {
  it("creates an owned pool for connection strings", () => {
    const db = createDbClient("postgres://user:pass@localhost:5432/app");

    expect(db.owned).toBe(true);
    expect(db.query).toBeTypeOf("function");
    expect(db.close).toBeTypeOf("function");
  });

  it("wraps existing queryable clients without owning them", () => {
    const client = { query: async () => ({ rows: [] }) };
    const db = createDbClient(client as never);

    expect(db.owned).toBe(false);
    expect(db.query).toBe(client.query);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter=@bossbench/core test -- src/db/client.test.ts`

Expected: FAIL with missing module.

**Step 3: Implement client factory**

Create `packages/core/src/db/client.ts`:

```ts
import { Pool, type QueryResult, type QueryResultRow } from "pg";
import type { BossbenchDb } from "../core/types";

export interface BossbenchQueryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}

export interface BossbenchDbClient extends BossbenchQueryable {
  owned: boolean;
  close(): Promise<void>;
}

export function createDbClient(db: BossbenchDb): BossbenchDbClient {
  if (typeof db === "string") {
    const pool = new Pool({ connectionString: db });
    return {
      owned: true,
      query: pool.query.bind(pool),
      close: () => pool.end(),
    };
  }

  return {
    owned: false,
    query: db.query.bind(db),
    close: async () => undefined,
  };
}
```

**Step 4: Run tests**

Run: `bun run --filter=@bossbench/core test -- src/db/client.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/core/src/db/client.ts packages/core/src/db/client.test.ts
git commit -m "feat: add postgres client factory"
```

## Task 6: Add repository interface and Postgres repository queue/job reads

**Files:**
- Create: `packages/core/src/repository/types.ts`
- Create: `packages/core/src/repository/postgres-repository.ts`
- Create: `packages/core/src/repository/postgres-repository.test.ts`

**Step 1: Write failing SQL behavior tests with fake query client**

Create `packages/core/src/repository/postgres-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PostgresBossbenchRepository } from "./postgres-repository";

describe("PostgresBossbenchRepository", () => {
  it("lists queues from the configured schema", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const repo = new PostgresBossbenchRepository({
      schema: "custom_boss",
      tags: [],
      db: {
        owned: false,
        close: async () => undefined,
        query: async (text, values) => {
          calls.push({ text, values });
          return { rows: [{ name: "email", policy: null, created: "2", retry: "1", active: "0", completed: "9", cancelled: "0", failed: "1" }] } as never;
        },
      },
    });

    const queues = await repo.listQueues();

    expect(calls[0]?.text).toContain('"custom_boss"."queue"');
    expect(queues[0]).toEqual({
      name: "email",
      policy: null,
      counts: { created: 2, retry: 1, active: 0, completed: 9, cancelled: 0, failed: 1 },
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter=@bossbench/core test -- src/repository/postgres-repository.test.ts`

Expected: FAIL with missing module.

**Step 3: Add repository interface**

Create `packages/core/src/repository/types.ts`:

```ts
import type { JobDetail, JobFilters, JobSummary, PaginatedResponse, QueueInfo } from "../core/types";

export interface OverviewStats {
  totalJobs: number;
  counts: QueueInfo["counts"];
  queues: QueueInfo[];
}

export interface ScheduleInfo {
  name: string;
  cron?: string | null;
  timezone?: string | null;
  data?: unknown;
}

export interface WarningInfo {
  id: string;
  message: string;
  createdOn: string;
  raw: Record<string, unknown>;
}

export interface MetricsResponse {
  buckets: Array<{
    timestamp: string;
    created: number;
    completed: number;
    failed: number;
    retry: number;
  }>;
}

export interface BossbenchRepository {
  getOverview(): Promise<OverviewStats>;
  listQueues(): Promise<QueueInfo[]>;
  getQueue(name: string): Promise<QueueInfo | null>;
  listJobs(filters: JobFilters): Promise<PaginatedResponse<JobSummary>>;
  getJob(id: string): Promise<JobDetail | null>;
  getSchedules(): Promise<ScheduleInfo[]>;
  getWarnings(filters: { limit: number; offset: number }): Promise<PaginatedResponse<WarningInfo>>;
  getMetrics(range: { from?: string; to?: string }): Promise<MetricsResponse>;
}
```

**Step 4: Implement queue reads**

Create `packages/core/src/repository/postgres-repository.ts`:

```ts
import type { BossbenchDbClient } from "../db/client";
import { quoteQualifiedTable } from "../db/identifiers";
import type { JobDetail, JobFilters, JobSummary, PaginatedResponse, QueueInfo } from "../core/types";
import type { BossbenchRepository, MetricsResponse, OverviewStats, ScheduleInfo, WarningInfo } from "./types";

const JOB_STATES = ["created", "retry", "active", "completed", "cancelled", "failed"] as const;

interface RepositoryOptions {
  schema: string;
  tags: string[];
  db: BossbenchDbClient;
}

export class PostgresBossbenchRepository implements BossbenchRepository {
  private readonly schema: string;
  private readonly tags: string[];
  private readonly db: BossbenchDbClient;

  constructor(options: RepositoryOptions) {
    this.schema = options.schema;
    this.tags = options.tags;
    this.db = options.db;
  }

  async listQueues(): Promise<QueueInfo[]> {
    const queueTable = quoteQualifiedTable(this.schema, "queue");
    const jobTable = quoteQualifiedTable(this.schema, "job");

    const result = await this.db.query<{
      name: string;
      policy: string | null;
      created: string;
      retry: string;
      active: string;
      completed: string;
      cancelled: string;
      failed: string;
    }>(`
      select
        q.name,
        q.policy,
        count(j.*) filter (where j.state = 'created') as created,
        count(j.*) filter (where j.state = 'retry') as retry,
        count(j.*) filter (where j.state = 'active') as active,
        count(j.*) filter (where j.state = 'completed') as completed,
        count(j.*) filter (where j.state = 'cancelled') as cancelled,
        count(j.*) filter (where j.state = 'failed') as failed
      from ${queueTable} q
      left join ${jobTable} j on j.name = q.name
      group by q.name, q.policy
      order by q.name asc
    `);

    return result.rows.map((row) => ({
      name: row.name,
      policy: row.policy,
      counts: {
        created: Number(row.created),
        retry: Number(row.retry),
        active: Number(row.active),
        completed: Number(row.completed),
        cancelled: Number(row.cancelled),
        failed: Number(row.failed),
      },
    }));
  }

  async getQueue(name: string): Promise<QueueInfo | null> {
    const queues = await this.listQueues();
    return queues.find((queue) => queue.name === name) ?? null;
  }

  async getOverview(): Promise<OverviewStats> {
    const queues = await this.listQueues();
    const counts = Object.fromEntries(JOB_STATES.map((state) => [state, 0])) as QueueInfo["counts"];

    for (const queue of queues) {
      for (const state of JOB_STATES) counts[state] += queue.counts[state];
    }

    return {
      totalJobs: Object.values(counts).reduce((sum, count) => sum + count, 0),
      counts,
      queues,
    };
  }

  async listJobs(_filters: JobFilters): Promise<PaginatedResponse<JobSummary>> {
    throw new Error("Not implemented");
  }

  async getJob(_id: string): Promise<JobDetail | null> {
    throw new Error("Not implemented");
  }

  async getSchedules(): Promise<ScheduleInfo[]> {
    return [];
  }

  async getWarnings(): Promise<PaginatedResponse<WarningInfo>> {
    return { data: [], total: 0, limit: 0, offset: 0, hasMore: false };
  }

  async getMetrics(): Promise<MetricsResponse> {
    return { buckets: [] };
  }
}
```

**Step 5: Run tests**

Run: `bun run --filter=@bossbench/core test -- src/repository/postgres-repository.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/repository
git commit -m "feat: add postgres repository queue reads"
```

## Task 7: Implement paginated jobs and job detail reads

**Files:**
- Modify: `packages/core/src/repository/postgres-repository.ts`
- Modify: `packages/core/src/repository/postgres-repository.test.ts`

**Step 1: Add failing tests for jobs**

Append to `packages/core/src/repository/postgres-repository.test.ts`:

```ts
it("lists jobs with state and queue filters", async () => {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const repo = new PostgresBossbenchRepository({
    schema: "pgboss",
    tags: ["teamId"],
    db: {
      owned: false,
      close: async () => undefined,
      query: async (text, values) => {
        calls.push({ text, values });
        if (text.includes("count(*)")) return { rows: [{ total: "1" }] } as never;
        return { rows: [{ id: "job-1", name: "email", state: "created", priority: 0, created_on: new Date("2026-01-01T00:00:00Z"), started_on: null, completed_on: null, retry_count: 0, retry_limit: 2, data: { teamId: "acme" } }] } as never;
      },
    },
  });

  const result = await repo.listJobs({ queue: "email", state: "created", limit: 10, offset: 0 });

  expect(calls[0]?.text).toContain("where");
  expect(calls[0]?.values).toEqual(["email", "created"]);
  expect(result.total).toBe(1);
  expect(result.data[0]?.tags).toEqual({ teamId: "acme" });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter=@bossbench/core test -- src/repository/postgres-repository.test.ts`

Expected: FAIL with `Not implemented`.

**Step 3: Implement `listJobs` and row mapping**

In `packages/core/src/repository/postgres-repository.ts`, add helper methods and replace `listJobs`:

```ts
  private buildJobWhere(filters: JobFilters): { where: string; values: unknown[] } {
    const clauses: string[] = [];
    const values: unknown[] = [];

    if (filters.queue) {
      values.push(filters.queue);
      clauses.push(`name = $${values.length}`);
    }

    if (filters.state) {
      values.push(filters.state);
      clauses.push(`state = $${values.length}`);
    }

    if (filters.q) {
      values.push(`%${filters.q}%`);
      clauses.push(`(id::text ilike $${values.length} or name ilike $${values.length} or data::text ilike $${values.length})`);
    }

    if (filters.from) {
      values.push(filters.from);
      clauses.push(`created_on >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      clauses.push(`created_on <= $${values.length}`);
    }

    return {
      where: clauses.length > 0 ? `where ${clauses.join(" and ")}` : "",
      values,
    };
  }

  private extractTags(data: unknown): Record<string, unknown> | undefined {
    if (!data || typeof data !== "object" || this.tags.length === 0) return undefined;

    const source = data as Record<string, unknown>;
    const tags = Object.fromEntries(this.tags.filter((tag) => tag in source).map((tag) => [tag, source[tag]]));

    return Object.keys(tags).length > 0 ? tags : undefined;
  }

  async listJobs(filters: JobFilters): Promise<PaginatedResponse<JobSummary>> {
    const jobTable = quoteQualifiedTable(this.schema, "job");
    const { where, values } = this.buildJobWhere(filters);

    const countResult = await this.db.query<{ total: string }>(`select count(*) as total from ${jobTable} ${where}`, values);
    const total = Number(countResult.rows[0]?.total ?? 0);

    const limitValue = values.length + 1;
    const offsetValue = values.length + 2;
    const rowsResult = await this.db.query<Record<string, unknown>>(
      `
        select id, name, state, priority, created_on, started_on, completed_on, retry_count, retry_limit, data
        from ${jobTable}
        ${where}
        order by created_on desc
        limit $${limitValue}
        offset $${offsetValue}
      `,
      [...values, filters.limit, filters.offset],
    );

    const data = rowsResult.rows.map((row) => this.mapJobSummary(row));

    return {
      data,
      total,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: filters.offset + data.length < total,
    };
  }

  private mapJobSummary(row: Record<string, unknown>): JobSummary {
    return {
      id: String(row.id),
      name: String(row.name),
      state: row.state as JobSummary["state"],
      priority: Number(row.priority ?? 0),
      createdOn: new Date(row.created_on as string | Date).toISOString(),
      startedOn: row.started_on ? new Date(row.started_on as string | Date).toISOString() : null,
      completedOn: row.completed_on ? new Date(row.completed_on as string | Date).toISOString() : null,
      retryCount: row.retry_count == null ? null : Number(row.retry_count),
      retryLimit: row.retry_limit == null ? null : Number(row.retry_limit),
      tags: this.extractTags(row.data),
    };
  }
```

**Step 4: Add and implement `getJob` similarly**

Add a failing test first for `getJob("job-1")`, then implement a parameterized `select * from ${jobTable} where id = $1 limit 1` and map to `JobDetail` with `data`, `output`, `deadLetter`, `policy`, `error`, and `raw`.

**Step 5: Run tests**

Run: `bun run --filter=@bossbench/core test -- src/repository/postgres-repository.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/repository/postgres-repository.ts packages/core/src/repository/postgres-repository.test.ts
git commit -m "feat: add job browsing repository"
```

## Task 8: Add pg-boss action service

**Files:**
- Create: `packages/core/src/actions/pgboss-actions.ts`
- Create: `packages/core/src/actions/pgboss-actions.test.ts`

**Step 1: Write failing tests**

Create `packages/core/src/actions/pgboss-actions.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { PgBossActionService } from "./pgboss-actions";

describe("PgBossActionService", () => {
  it("requires a boss instance for actions", async () => {
    const service = new PgBossActionService(undefined);

    await expect(service.retry("email", "job-1")).rejects.toMatchObject({ code: "BOSS_INSTANCE_REQUIRED" });
  });

  it("delegates retry to pg-boss", async () => {
    const boss = { retry: vi.fn().mockResolvedValue(1) };
    const service = new PgBossActionService(boss as never);

    await service.retry("email", "job-1");

    expect(boss.retry).toHaveBeenCalledWith("email", "job-1");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter=@bossbench/core test -- src/actions/pgboss-actions.test.ts`

Expected: FAIL with missing module.

**Step 3: Implement action service**

Create `packages/core/src/actions/pgboss-actions.ts`:

```ts
import type PgBoss from "pg-boss";

export class BossbenchActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export class PgBossActionService {
  constructor(private readonly boss: PgBoss | undefined) {}

  private requireBoss(): PgBoss {
    if (!this.boss) {
      throw new BossbenchActionError("BOSS_INSTANCE_REQUIRED", "Actions require a pg-boss instance.");
    }

    return this.boss;
  }

  async retry(queue: string, id: string): Promise<void> {
    await this.requireBoss().retry(queue, id);
  }

  async cancel(queue: string, id: string): Promise<void> {
    await this.requireBoss().cancel(queue, id);
  }

  async resume(queue: string, id: string): Promise<void> {
    await this.requireBoss().resume(queue, id);
  }

  async delete(queue: string, id: string): Promise<void> {
    await this.requireBoss().deleteJob(queue, id);
  }
}
```

**Step 4: Add tests for cancel/resume/delete**

Add similar delegation tests for `cancel`, `resume`, and `delete`.

**Step 5: Run tests**

Run: `bun run --filter=@bossbench/core test -- src/actions/pgboss-actions.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/actions
git commit -m "feat: add pgboss action service"
```

## Task 9: Add BossbenchCore composition

**Files:**
- Create: `packages/core/src/core/bossbench.ts`
- Create: `packages/core/src/core/bossbench.test.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Write failing tests**

Create `packages/core/src/core/bossbench.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BossbenchCore } from "./bossbench";

describe("BossbenchCore", () => {
  it("exposes UI-safe config", () => {
    const core = new BossbenchCore({ db: "postgres://example", auth: { username: "admin", password: "secret" }, tags: ["teamId"] });

    expect(core.getConfig()).toEqual({
      title: "Bossbench",
      logo: undefined,
      readonly: false,
      schema: "pgboss",
      tags: ["teamId"],
      actionsEnabled: false,
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter=@bossbench/core test -- src/core/bossbench.test.ts`

Expected: FAIL with missing module.

**Step 3: Implement core composition**

Create `packages/core/src/core/bossbench.ts`:

```ts
import { PgBossActionService } from "../actions/pgboss-actions";
import { createDbClient } from "../db/client";
import { PostgresBossbenchRepository } from "../repository/postgres-repository";
import { normalizeOptions } from "./options";
import type { BossbenchOptions, NormalizedBossbenchOptions } from "./types";

export class BossbenchCore {
  readonly options: NormalizedBossbenchOptions;
  readonly repository: PostgresBossbenchRepository;
  readonly actions: PgBossActionService;

  constructor(options: BossbenchOptions) {
    this.options = normalizeOptions(options);
    const db = createDbClient(this.options.db ?? inferDbFromBoss(this.options.boss));

    this.repository = new PostgresBossbenchRepository({
      schema: this.options.schema,
      tags: this.options.tags,
      db,
    });
    this.actions = new PgBossActionService(this.options.boss);
  }

  requiresAuth(): boolean {
    return Boolean(this.options.auth?.username && this.options.auth?.password);
  }

  validateAuth(username: string, password: string): boolean {
    if (!this.requiresAuth()) return true;
    return username === this.options.auth?.username && password === this.options.auth?.password;
  }

  getConfig() {
    return {
      title: this.options.title,
      logo: this.options.logo,
      readonly: this.options.readonly,
      schema: this.options.schema,
      tags: this.options.tags,
      actionsEnabled: Boolean(this.options.boss && !this.options.readonly),
    };
  }
}

function inferDbFromBoss(_boss: BossbenchOptions["boss"]): never {
  throw new Error("Bossbench requires db when boss connection inference is not implemented");
}
```

**Step 4: Export core**

Modify `packages/core/src/index.ts`:

```ts
export { BossbenchCore } from "./core/bossbench";
export { normalizeOptions } from "./core/options";
```

Keep previous type exports.

**Step 5: Run tests**

Run: `bun run --filter=@bossbench/core test -- src/core/bossbench.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/core/bossbench.ts packages/core/src/core/bossbench.test.ts packages/core/src/index.ts
git commit -m "feat: compose bossbench core"
```

## Task 10: Add API router

**Files:**
- Create: `packages/core/src/api/router.ts`
- Create: `packages/core/src/api/router.test.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Write failing API tests**

Create `packages/core/src/api/router.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApiRoutes } from "./router";

describe("createApiRoutes", () => {
  it("returns config without secrets", async () => {
    const app = createApiRoutes({
      getConfig: () => ({ title: "Bossbench", readonly: false, schema: "pgboss", tags: [], actionsEnabled: false }),
    } as never);

    const res = await app.request("/config");
    const body = await res.json();

    expect(body).toEqual({ title: "Bossbench", readonly: false, schema: "pgboss", tags: [], actionsEnabled: false });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter=@bossbench/core test -- src/api/router.test.ts`

Expected: FAIL with missing module.

**Step 3: Implement API router**

Create `packages/core/src/api/router.ts`:

```ts
import { Hono } from "hono";
import type { BossbenchCore } from "../core/bossbench";

export function createApiRoutes(core: BossbenchCore): Hono {
  const app = new Hono();

  app.get("/config", (c) => c.json(core.getConfig()));
  app.post("/refresh", (c) => c.json({ success: true }));
  app.get("/overview", async (c) => c.json(await core.repository.getOverview()));
  app.get("/queues", async (c) => c.json(await core.repository.listQueues()));
  app.get("/queues/:name", async (c) => {
    const queue = await core.repository.getQueue(c.req.param("name"));
    return queue ? c.json(queue) : c.json({ error: { code: "QUEUE_NOT_FOUND", message: "Queue not found" } }, 404);
  });
  app.get("/jobs", async (c) => {
    const limit = Number(c.req.query("limit") ?? 50);
    const offset = Number(c.req.query("offset") ?? 0);
    return c.json(await core.repository.listJobs({
      queue: c.req.query("queue"),
      state: c.req.query("state") as never,
      q: c.req.query("q"),
      from: c.req.query("from"),
      to: c.req.query("to"),
      limit,
      offset,
    }));
  });

  return app;
}
```

**Step 4: Add action endpoints with readonly checks**

Extend `router.test.ts` with tests for `READONLY_MODE` and `BOSS_INSTANCE_REQUIRED`, then add endpoints:

```txt
POST /jobs/:queue/:id/retry
POST /jobs/:queue/:id/cancel
POST /jobs/:queue/:id/resume
POST /jobs/:queue/:id/delete
```

Each endpoint must check `core.options.readonly` before calling `core.actions`.

**Step 5: Export router**

Modify `packages/core/src/index.ts`:

```ts
export { createApiRoutes } from "./api/router";
```

**Step 6: Run tests**

Run: `bun run --filter=@bossbench/core test -- src/api/router.test.ts`

Expected: PASS.

**Step 7: Commit**

```bash
git add packages/core/src/api packages/core/src/index.ts
git commit -m "feat: add core api router"
```

## Task 11: Add Hono adapter

**Files:**
- Create: `packages/hono/package.json`
- Create: `packages/hono/tsconfig.json`
- Create: `packages/hono/tsup.config.ts`
- Create: `packages/hono/src/index.ts`
- Create: `packages/hono/src/index.test.ts`

**Step 1: Create package files**

Create `packages/hono/package.json` with dependencies on `@bossbench/core` and peer deps `hono`, `pg`, `pg-boss`.

Create `packages/hono/tsconfig.json` extending `../../tsconfig.base.json`.

Create `packages/hono/tsup.config.ts` with entry `src/index.ts` and ESM output.

**Step 2: Write failing adapter test**

Create `packages/hono/src/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bossbench } from "./index";

describe("hono bossbench", () => {
  it("serves config", async () => {
    const app = bossbench({ db: "postgres://example" });
    const res = await app.request("/api/config");

    expect(res.status).toBe(200);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `bun run --filter=@bossbench/hono test`

Expected: FAIL with missing implementation.

**Step 4: Implement Hono adapter**

Create `packages/hono/src/index.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BossbenchCore, createApiRoutes, UI_DIST_PATH, type BossbenchOptions } from "@bossbench/core";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { cors } from "hono/cors";

export function bossbench(options: BossbenchOptions): Hono {
  const core = new BossbenchCore(options);
  const app = new Hono();

  app.use("/api/*", cors());

  if (core.requiresAuth()) {
    app.use("*", basicAuth({ username: core.options.auth!.username, password: core.options.auth!.password }));
  }

  app.route("/api", createApiRoutes(core));

  app.get("/assets/:file", (c) => {
    const fileName = c.req.param("file");
    const filePath = join(UI_DIST_PATH, "assets", fileName);
    if (!existsSync(filePath)) return c.text("Not found", 404);
    const contentType = fileName.endsWith(".js") ? "application/javascript" : fileName.endsWith(".css") ? "text/css" : "application/octet-stream";
    return c.body(readFileSync(filePath), 200, { "Content-Type": contentType });
  });

  app.get("*", (c) => {
    const indexPath = join(UI_DIST_PATH, "index.html");
    if (existsSync(indexPath)) return c.html(readFileSync(indexPath, "utf-8"));
    return c.html(`<h1>${core.options.title}</h1><p>UI assets not found. Build @bossbench/core first.</p>`);
  });

  return app;
}

export type { BossbenchOptions } from "@bossbench/core";
```

**Step 5: Run tests/typecheck**

Run: `bun run --filter=@bossbench/hono test`

Expected: PASS.

Run: `bun run --filter=@bossbench/hono typecheck`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/hono package.json bun.lock
git commit -m "feat: add hono adapter"
```

## Task 12: Add Express adapter

**Files:**
- Create: `packages/express/package.json`
- Create: `packages/express/tsconfig.json`
- Create: `packages/express/tsup.config.ts`
- Create: `packages/express/src/index.ts`
- Create: `packages/express/src/index.test.ts`

**Step 1: Create package files**

Create `packages/express/package.json` with dependencies on `@bossbench/core`, `express`, and `hono`, plus peer deps `express`, `pg`, `pg-boss`.

**Step 2: Write failing Express adapter test**

Create `packages/express/src/index.test.ts`:

```ts
import express from "express";
import { describe, expect, it } from "vitest";
import { bossbench } from "./index";

describe("express bossbench", () => {
  it("returns a router", () => {
    const app = express();
    app.use("/jobs", bossbench({ db: "postgres://example" }));

    expect(app).toBeDefined();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `bun run --filter=@bossbench/express test`

Expected: FAIL with missing implementation.

**Step 4: Implement Express adapter**

Create `packages/express/src/index.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BossbenchCore, createApiRoutes, UI_DIST_PATH, type BossbenchOptions } from "@bossbench/core";
import express, { type Router } from "express";

export function bossbench(options: BossbenchOptions): Router {
  const core = new BossbenchCore(options);
  const router = express.Router();

  if (core.requiresAuth()) {
    router.use((req, res, next) => {
      const header = req.headers.authorization;
      if (!header?.startsWith("Basic ")) {
        res.setHeader("WWW-Authenticate", "Basic");
        res.status(401).send("Unauthorized");
        return;
      }
      const [username, password] = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8").split(":");
      if (!core.validateAuth(username ?? "", password ?? "")) {
        res.status(401).send("Unauthorized");
        return;
      }
      next();
    });
  }

  router.use("/api", async (req, res) => {
    const url = new URL(req.originalUrl.replace(req.baseUrl, ""), `${req.protocol}://${req.headers.host}`);
    const request = new Request(url, { method: req.method, headers: req.headers as HeadersInit });
    const response = await createApiRoutes(core).fetch(request);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(Buffer.from(await response.arrayBuffer()));
  });

  router.get("/assets/:file", (req, res) => {
    const filePath = join(UI_DIST_PATH, "assets", req.params.file);
    if (!existsSync(filePath)) return res.status(404).send("Not found");
    res.type(req.params.file.endsWith(".js") ? "application/javascript" : req.params.file.endsWith(".css") ? "text/css" : "application/octet-stream");
    res.send(readFileSync(filePath));
  });

  router.get("*", (_req, res) => {
    const indexPath = join(UI_DIST_PATH, "index.html");
    if (existsSync(indexPath)) return res.type("html").send(readFileSync(indexPath, "utf-8"));
    res.type("html").send(`<h1>${core.options.title}</h1><p>UI assets not found. Build @bossbench/core first.</p>`);
  });

  return router;
}

export type { BossbenchOptions } from "@bossbench/core";
```

**Step 5: Run tests/typecheck**

Run: `bun run --filter=@bossbench/express test`

Expected: PASS.

Run: `bun run --filter=@bossbench/express typecheck`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/express package.json bun.lock
git commit -m "feat: add express adapter"
```

## Task 13: Build the first functional React UI shell

**Files:**
- Create: `packages/core/src/ui/app.tsx`
- Create: `packages/core/src/ui/api.ts`
- Create: `packages/core/src/ui/styles.css`
- Modify: `packages/core/src/ui/main.tsx`

**Step 1: Add UI API client**

Create `packages/core/src/ui/api.ts`:

```ts
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`api${path}`);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}
```

**Step 2: Add app shell**

Create `packages/core/src/ui/app.tsx`:

```tsx
import { useEffect, useState } from "react";
import { apiGet } from "./api";
import "./styles.css";

interface Config {
  title: string;
  readonly: boolean;
  schema: string;
  actionsEnabled: boolean;
}

export function App() {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    apiGet<Config>("/config").then(setConfig).catch(() => setConfig({ title: "Bossbench", readonly: true, schema: "unknown", actionsEnabled: false }));
  }, []);

  return (
    <main className="shell">
      <aside className="sidebar">
        <h1>{config?.title ?? "Bossbench"}</h1>
        <nav>
          {[
            "Overview",
            "Queues",
            "Jobs",
            "Schedules",
            "Dead Letter",
            "Warnings",
            "Metrics",
            "Activity",
            "Settings",
          ].map((item) => (
            <a href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>{item}</a>
          ))}
        </nav>
      </aside>
      <section className="content">
        <p className="eyebrow">Schema: {config?.schema ?? "loading"}</p>
        <h2>pg-boss operations dashboard</h2>
        <p>Queue, job, schedule, warning, dead-letter, and metrics views for pg-boss.</p>
        {config && !config.actionsEnabled ? <p className="notice">Browse-only mode: actions are disabled.</p> : null}
      </section>
    </main>
  );
}
```

**Step 3: Add styles**

Create `packages/core/src/ui/styles.css`:

```css
* { box-sizing: border-box; }
body { margin: 0; background: #08090a; color: #f5f5f5; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
a { color: inherit; text-decoration: none; }
.shell { min-height: 100vh; display: grid; grid-template-columns: 260px 1fr; }
.sidebar { border-right: 1px solid #24262b; padding: 24px; background: #0d0f12; }
.sidebar h1 { font-size: 20px; margin: 0 0 24px; }
.sidebar nav { display: grid; gap: 8px; }
.sidebar a { border-radius: 10px; color: #b8beca; padding: 10px 12px; }
.sidebar a:hover { background: #171a20; color: #fff; }
.content { padding: 48px; }
.eyebrow { color: #8b93a7; text-transform: uppercase; letter-spacing: .12em; font-size: 12px; }
.content h2 { font-size: 40px; margin: 8px 0 12px; }
.notice { border: 1px solid #3b4252; background: #151923; border-radius: 12px; padding: 12px 14px; max-width: 520px; }
@media (max-width: 800px) { .shell { grid-template-columns: 1fr; } .sidebar { border-right: 0; border-bottom: 1px solid #24262b; } }
```

**Step 4: Wire main**

Modify `packages/core/src/ui/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./app";

createRoot(document.getElementById("root")!).render(<App />);
```

**Step 5: Run UI build**

Run: `bun run --filter=@bossbench/core build:ui`

Expected: PASS and `packages/core/dist/ui` generated.

**Step 6: Commit**

```bash
git add packages/core/src/ui packages/core/dist
git commit -m "feat: add dashboard ui shell"
```

## Task 14: Add repository reads for schedules, warnings, metrics, and dead letters

**Files:**
- Modify: `packages/core/src/repository/types.ts`
- Modify: `packages/core/src/repository/postgres-repository.ts`
- Modify: `packages/core/src/repository/postgres-repository.test.ts`
- Modify: `packages/core/src/api/router.ts`
- Modify: `packages/core/src/api/router.test.ts`

**Step 1: Add failing repository tests**

Add tests for:

- `getSchedules()` queries schedule data from pg-boss tables/functions available in installed schema.
- `getWarnings({ limit, offset })` queries `warning` table and returns pagination metadata.
- `getMetrics({ from, to })` groups `job` table by hour/day and state.
- `listDeadLetterJobs(filters)` returns failed/dead-letter jobs.

Use a fake query client first. Keep assertions focused on safe schema qualification and parameter values.

**Step 2: Run tests to verify they fail**

Run: `bun run --filter=@bossbench/core test -- src/repository/postgres-repository.test.ts`

Expected: FAIL with missing methods or empty placeholder behavior.

**Step 3: Implement repository methods**

Update `PostgresBossbenchRepository` with direct SQL for:

- schedules
- warnings
- metrics aggregation
- dead-letter jobs

Use `quoteQualifiedTable(this.schema, "job")`, `quoteQualifiedTable(this.schema, "schedule")`, and `quoteQualifiedTable(this.schema, "warning")`. If pg-boss version differences make a table unavailable, catch undefined-table errors and return explanatory empty data at API level.

**Step 4: Add API endpoints**

Update `packages/core/src/api/router.ts` with:

```txt
GET /schedules
GET /warnings
GET /metrics
GET /dead-letter
GET /activity
GET /search
GET /tags/:field/values
```

**Step 5: Run tests**

Run: `bun run --filter=@bossbench/core test`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/repository packages/core/src/api
git commit -m "feat: add advanced dashboard reads"
```

## Task 15: Add integration tests with Postgres and pg-boss

**Files:**
- Create: `packages/core/src/test/pgboss-fixture.ts`
- Create: `packages/core/src/repository/postgres-repository.integration.test.ts`
- Modify: `packages/core/vitest.config.ts`
- Create: `docker-compose.yml`

**Step 1: Add Docker compose for local integration tests**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: bossbench
    ports:
      - "54329:5432"
```

**Step 2: Add fixture helper**

Create `packages/core/src/test/pgboss-fixture.ts` that connects to `postgres://postgres:postgres@localhost:54329/bossbench`, starts pg-boss with schema `pgboss`, creates queues, sends jobs in multiple states, and exposes cleanup.

**Step 3: Write integration tests**

Create `packages/core/src/repository/postgres-repository.integration.test.ts` with tests for:

- `listQueues()` returns seeded queues.
- `listJobs()` paginates and filters by state.
- `getJob()` returns payload details.
- `getOverview()` counts states.

**Step 4: Run Postgres**

Run: `docker compose up -d postgres`

Expected: Postgres starts on port `54329`.

**Step 5: Run integration tests**

Run: `bun run --filter=@bossbench/core test -- src/repository/postgres-repository.integration.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add docker-compose.yml packages/core/src/test packages/core/src/repository/postgres-repository.integration.test.ts packages/core/vitest.config.ts
git commit -m "test: add pgboss repository integration tests"
```

## Task 16: Add example Hono and Express apps

**Files:**
- Create: `examples/hono/package.json`
- Create: `examples/hono/src/index.ts`
- Create: `examples/express/package.json`
- Create: `examples/express/src/index.ts`
- Create: `examples/README.md`

**Step 1: Create Hono example**

Create `examples/hono/src/index.ts` showing pg-boss startup, a sample queue, and Bossbench mounted at `/jobs`.

**Step 2: Create Express example**

Create `examples/express/src/index.ts` showing the same setup with `app.use("/jobs", bossbench(...))`.

**Step 3: Add example README**

Document:

- required `DATABASE_URL`
- `BOSSBENCH_USER`
- `BOSSBENCH_PASS`
- how to start Postgres
- how to run each example

**Step 4: Run typechecks**

Run: `bun run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add examples package.json bun.lock
git commit -m "docs: add hono and express examples"
```

## Task 17: Add CLI installer scaffold

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/tsup.config.ts`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/init.ts`
- Create: `packages/cli/src/lib/package-manager.ts`
- Create: `packages/cli/src/lib/project-detect.ts`
- Create: `packages/cli/src/lib/inject.ts`
- Create: `packages/cli/src/commands/init.test.ts`

**Step 1: Write failing CLI tests**

Test project detection for Hono and Express using fixture file contents.

**Step 2: Implement package manager detection**

Detect `bun.lock`, `pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`.

**Step 3: Implement Hono/Express detection**

Look for dependency names and imports in common entry files.

**Step 4: Implement route injection helpers**

For Hono, inject:

```ts
import { bossbench } from "@bossbench/hono";

app.route("/jobs", bossbench({
  db: process.env.DATABASE_URL!,
  auth: {
    username: process.env.BOSSBENCH_USER!,
    password: process.env.BOSSBENCH_PASS!,
  },
}));
```

For Express, inject:

```ts
import { bossbench } from "@bossbench/express";

app.use("/jobs", bossbench({
  db: process.env.DATABASE_URL!,
  auth: {
    username: process.env.BOSSBENCH_USER!,
    password: process.env.BOSSBENCH_PASS!,
  },
}));
```

**Step 5: Run CLI tests**

Run: `bun run --filter=@bossbench/cli test`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/cli package.json bun.lock
git commit -m "feat: add bossbench cli init"
```

## Task 18: Add simple marketing/docs site

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/globals.css`

**Step 1: Scaffold minimal Next.js app**

Use a minimal Next app under `apps/web`.

**Step 2: Add homepage content**

Page should state:

- "A beautiful, open-source pg-boss dashboard for modern Node apps."
- Quick start command: `npx @bossbench/cli init`
- Hono and Express support
- SQL-backed reads, pg-boss-backed actions
- Screens/features list

**Step 3: Run web build**

Run: `bun run --filter=bossbench-web build`

Expected: PASS.

**Step 4: Commit**

```bash
git add apps/web package.json bun.lock
git commit -m "feat: add marketing site"
```

## Task 19: Polish UI into full v1 screens

**Files:**
- Modify/Create under: `packages/core/src/ui/**`

**Step 1: Create screen components**

Create components/pages for:

- `overview-page.tsx`
- `queues-page.tsx`
- `jobs-page.tsx`
- `job-detail-page.tsx`
- `schedules-page.tsx`
- `dead-letter-page.tsx`
- `warnings-page.tsx`
- `metrics-page.tsx`
- `activity-page.tsx`
- `settings-page.tsx`

**Step 2: Add API hooks**

Use React Query hooks for each API resource.

**Step 3: Add filters and pagination to Jobs page**

Implement queue, state, search, date range, tags, page size, and offset pagination.

**Step 4: Add mutation controls**

Add retry/cancel/resume/delete controls. Hide or disable when `readonly` or `actionsEnabled` is false.

**Step 5: Add empty and error states**

Every screen needs a helpful empty state and an API error state.

**Step 6: Route screens**

Use TanStack Router or a lightweight hash router. Keep routing simple and compatible with embedded base paths.

**Step 7: Run UI build**

Run: `bun run --filter=@bossbench/core build:ui`

Expected: PASS.

**Step 8: Route UI review**

Use @designer to review visual polish, responsiveness, empty states, and interaction clarity.

**Step 9: Commit**

```bash
git add packages/core/src/ui
git commit -m "feat: build bossbench dashboard screens"
```

## Task 20: Final verification and release readiness

**Files:**
- Modify: `README.md`
- Modify/Create: package READMEs under `packages/*/README.md`
- Modify/Create: `CHANGELOG.md`

**Step 1: Add package documentation**

Document install and usage for:

- `@bossbench/hono`
- `@bossbench/express`
- `@bossbench/core`
- `@bossbench/cli`

**Step 2: Run full checks**

Run: `bun run lint`

Expected: PASS.

Run: `bun run typecheck`

Expected: PASS.

Run: `bun run test`

Expected: PASS.

Run: `bun run build`

Expected: PASS.

**Step 3: Smoke test adapters**

Run Hono example and visit `/jobs/api/config`.

Expected: JSON config response with no secrets.

Run Express example and visit `/jobs/api/config`.

Expected: JSON config response with no secrets.

**Step 4: Request code review**

Use @oracle for architecture/security review of:

- SQL identifier handling
- SQL filtering/search safety
- action service behavior
- adapter auth behavior
- read-only enforcement

Use @designer for final UI/UX review.

**Step 5: Fix review findings**

Apply only verified findings. Rerun relevant checks after every fix batch.

**Step 6: Final commit**

```bash
git add README.md packages apps examples CHANGELOG.md
git commit -m "docs: prepare bossbench v1"
```

## Execution notes

- Use `@fixer` for bounded package implementation tasks once tests and exact requirements are clear.
- Use `@designer` for the UI shell and full dashboard polish.
- Use `@oracle` for security/architecture reviews before final completion.
- Use the existing librarian research session only if pg-boss API details need clarification.

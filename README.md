# Bossbench

Open-source pg-boss dashboard. Drop-in for modern Node backends.

Bossbench is inspired by Workbench's embedded dashboard model, but is pg-boss-native: it reads queue/job/schedule/warning/metric data from Postgres and uses a provided `PgBoss` instance for safe mutations.

## Features

- Workbench-style embedded dashboard UI.
- Hono and Express adapters.
- Queues, jobs, schedules, warnings, dead-letter, metrics, activity, and settings screens.
- Actions for retry, cancel, resume, delete, schedule, and unschedule when a `PgBoss` instance is provided.
- SQL-backed pagination, filtering, search, and configured JSON tag filters.
- Basic auth by default; explicit `allowUnauthenticated: true` is required for unprotected local browsing.
- Read-only fallback when no `PgBoss` instance is connected.

## Quick start

```bash
npx @bossbench/cli init
```

The CLI detects Hono or Express, updates `.env.example`, updates package metadata, and injects a `/jobs` mount into common app entry files.

## Local demo

Use the standalone demo to test the dashboard with seeded pg-boss data:

```bash
docker compose up -d --pull never postgres
bun install
bun run --filter=@bossbench/example-demo dev
```

Then open http://localhost:3000/jobs and sign in with:

- Username: `admin`
- Password: `change-me`

The demo seeds example queues, jobs, schedules, warnings, metrics, dead-letter data, and `teamId` tags.

## Hono

```bash
npm install @bossbench/hono pg pg-boss
```

```ts
import PgBoss from "pg-boss";
import { Hono } from "hono";
import { bossbench } from "@bossbench/hono";

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss" });
await boss.start();

const app = new Hono();

app.route(
  "/jobs",
  bossbench({
    boss,
    db: process.env.DATABASE_URL!,
    basePath: "/jobs",
    auth: {
      username: process.env.BOSSBENCH_USER!,
      password: process.env.BOSSBENCH_PASS!,
    },
  }),
);

export default app;
```

## Express

```bash
npm install @bossbench/express pg pg-boss
```

```ts
import express from "express";
import PgBoss from "pg-boss";
import { bossbench } from "@bossbench/express";

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss" });
await boss.start();

const app = express();

app.use(
  "/jobs",
  bossbench({
    boss,
    db: process.env.DATABASE_URL!,
    basePath: "/jobs",
    auth: {
      username: process.env.BOSSBENCH_USER!,
      password: process.env.BOSSBENCH_PASS!,
    },
  }),
);

export default app;
```

## Options

| Option | Description |
| --- | --- |
| `boss` | Optional `PgBoss` instance. Required for mutations. |
| `db` | Postgres connection string, `Pool`, or `Client`. Required for dashboard reads unless your app passes a compatible connection separately. |
| `schema` | pg-boss schema. Defaults to `pgboss`. |
| `auth` | Basic auth credentials. Required unless `allowUnauthenticated: true`. |
| `allowUnauthenticated` | Explicitly allow unprotected browsing. Defaults to `false`. |
| `readonly` | Disable all mutations. Defaults to `true` without auth, `false` with auth. |
| `tags` | Fields from `job.data` that can be used as filters. |

## Development

```bash
bun install
bun run lint
bun run typecheck
bun run test
docker compose up -d --pull never postgres
bun run test:integration
bun run build
```

## Packages

- `@bossbench/core`
- `@bossbench/hono`
- `@bossbench/express`
- `@bossbench/cli`

## License

MIT

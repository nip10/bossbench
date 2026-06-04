# Bossbench

Open-source pg-boss dashboard. Drop-in for modern Node backends.

Bossbench is inspired by Workbench's embedded dashboard model, but is pg-boss-native: it reads queue/job/schedule/warning/metric data from Postgres and uses a provided `PgBoss` instance for safe mutations.

## Features

- Workbench-style embedded dashboard UI.
- Hono, h3, Nuxt/Nitro, AdonisJS, TanStack Start, Express, Fastify, Elysia, NestJS, and Next.js adapters.
- A standalone read-only-first app for external pg-boss/Postgres deployments.
- Queues, jobs, schedules, warnings, dead-letter, metrics, activity, alerts, and settings screens.
- Config-driven pg-boss alert rules with webhook, Slack, and Discord payload helpers.
- Actions for retry, cancel, resume, delete, schedule, and unschedule when a `PgBoss` instance is provided.
- SQL-backed pagination, filtering, search, and configured JSON tag filters.
- Basic auth by default; explicit `allowUnauthenticated: true` is required for unprotected local browsing.
- Read-only fallback when no `PgBoss` instance is connected.

## Quick start

```bash
npx @bossbench/cli init
```

The CLI auto-injects Hono, h3, Nuxt/Nitro, AdonisJS, TanStack Start, Express, Fastify, Elysia, NestJS, and Next.js projects.

Queue clean is split into preview and delete: `allowQueueClean` enables preview only, `allowQueueCleanDelete` enables irreversible deletion, and exact confirmation text is required before a delete runs. Deletions target pg-boss storage directly, so failed deletion removes the underlying dead-letter/retry evidence. Clean is batch-limited, so repeat it while `hasMore` is true to drain large backlogs.

## Examples

- `examples/demo` - seeded Hono demo
- `examples/with-hono`
- `examples/with-h3`
- `examples/with-nuxt`
- `examples/with-adonis`
- `examples/with-tanstack-start`
- `examples/with-express`
- `examples/with-fastify`
- `examples/with-elysia`
- `examples/with-nestjs`
- `examples/with-next`

## Standalone app

Use `apps/standalone` to run Bossbench directly against an external pg-boss/Postgres database.

Required env:

- `DATABASE_URL`

Optional env:

- `PGBOSS_SCHEMA` (default `pgboss`)
- `BASE_PATH` (default `/`)
- `HOST` (default `0.0.0.0`)
- `PORT` (default `3000`)
- `BOSSBENCH_USER` / `BOSSBENCH_PASS`
- `WRITABLE=true` (only enables mutations when auth is set)

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
| `allowManualEnqueue` | Enable manual enqueue and enqueue-copy actions. Defaults to `false`. |
| `allowQueueClean` | Enable queue clean preview only. Defaults to `false`. |
| `allowQueueCleanDelete` | Enable irreversible queue clean deletion. Requires exact confirmation and direct SQL safety. Defaults to `false`. |
| `alerts` | Optional config-driven alert rules and contact points. Evaluation is SQL-backed and read-only; delivery runners are opt-in. |
| `tags` | Fields from `job.data` that can be used as filters. |

## Alerts

Bossbench alerting is pg-boss/Postgres-native. Rules are configured in code, evaluated from SQL-backed queue/job/warning data, and displayed on the dashboard Alerts page. This avoids storing webhook secrets in the browser or mutating pg-boss tables for alert setup.

```ts
bossbench({
  db: process.env.DATABASE_URL!,
  auth: {
    username: process.env.BOSSBENCH_USER!,
    password: process.env.BOSSBENCH_PASS!,
  },
  alerts: {
    enabled: true,
    rules: [
      {
        id: "email-failures",
        name: "Email failures",
        type: "failed_count",
        queue: "email",
        windowMinutes: 15,
        threshold: 5,
        severity: "critical",
        cooldownMinutes: 30,
        contactPointIds: ["ops"],
      },
    ],
    contactPoints: [
      {
        id: "ops",
        name: "Ops webhook",
        type: "slack",
        urlEnv: "BOSSBENCH_ALERT_WEBHOOK",
      },
    ],
  },
});
```

Supported rule types are `failed_count`, `dead_letter_count`, `retry_backlog_count`, `oldest_created_age`, `avg_wait_ms`, `avg_duration_ms`, and `warning_count`. `oldest_created_age` thresholds are seconds; wait and duration thresholds are milliseconds. Generic webhook, Slack, and Discord payloads are plain JSON; run delivery from one server-side process or behind your own deployment-level single-runner guard to avoid duplicate notifications in replicated apps.

## Development

```bash
bun install
bun run lint
bun run typecheck
bun run test
bun run smoke
docker compose up -d --pull never postgres
bun run test:integration
bun run build
```

## Releasing

Bossbench uses Changesets for npm releases and conventional commits for commit hygiene.

```bash
bun run changeset
bun run version-packages
bun run release
```

CI runs oxlint, Biome, typechecks, unit tests, pg-boss/Postgres integration tests, and builds. Publishing runs through the `Release` GitHub Action and requires `NPM_TOKEN`.

## Packages

- `@bossbench/core`
- `@bossbench/hono`
- `@bossbench/h3`
- `@bossbench/nuxt`
- `@bossbench/adonis`
- `@bossbench/tanstack-start`
- `@bossbench/express`
- `@bossbench/fastify`
- `@bossbench/elysia`
- `@bossbench/nestjs`
- `@bossbench/next`
- `@bossbench/cli`
- `@bossbench/mcp`

## License

MIT

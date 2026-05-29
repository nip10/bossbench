# Bossbench

Open-source pg-boss dashboard. Drop-in for modern Node backends.

Bossbench is inspired by Workbench's embedded dashboard model, but is pg-boss-native: it reads queue/job/schedule/warning/metric data from Postgres and uses a provided `PgBoss` instance for safe mutations.

## Features

- Workbench-style embedded dashboard UI.
- Hono, h3, Nuxt/Nitro, AdonisJS, TanStack Start, Express, Fastify, Elysia, NestJS, and Next.js adapters.
- A standalone read-only-first app for external pg-boss/Postgres deployments.
- Queues, jobs, schedules, warnings, dead-letter, metrics, activity, and settings screens.
- Actions for retry, cancel, resume, delete, schedule, and unschedule when a `PgBoss` instance is provided.
- SQL-backed pagination, filtering, search, and configured JSON tag filters.
- Basic auth by default; explicit `allowUnauthenticated: true` is required for unprotected local browsing.
- Read-only fallback when no `PgBoss` instance is connected.

## Quick start

```bash
npx @bossbench/cli init
```

The CLI auto-injects Hono, h3, Nuxt/Nitro, AdonisJS, TanStack Start, Express, Fastify, Elysia, NestJS, and Next.js projects.

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
| `allowQueueClean` | Enable queue clean capabilities when the safety design lands. Defaults to `false`. |
| `tags` | Fields from `job.data` that can be used as filters. |

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

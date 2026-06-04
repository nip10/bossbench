# @bossbench/core

Core package for Bossbench. It contains the pg-boss/Postgres repository, action service, API routes, and bundled dashboard UI.

## Adapter matrix

| Package | Framework | Mount style |
| --- | --- | --- |
| `@bossbench/hono` | Hono | `app.route()` |
| `@bossbench/h3` | h3 / Nitro | handler wrapper |
| `@bossbench/nuxt` | Nuxt / Nitro | route module |
| `@bossbench/adonis` | AdonisJS | router mount |
| `@bossbench/tanstack-start` | TanStack Start | route handlers |
| `@bossbench/express` | Express | `app.use()` |
| `@bossbench/fastify` | Fastify | plugin |
| `@bossbench/elysia` | Elysia | plugin |
| `@bossbench/nestjs` | NestJS | controller/module |
| `@bossbench/next` | Next.js | route handlers |

## CLI setup

```bash
npx @bossbench/cli init
```

The CLI detects Hono, h3, Nuxt/Nitro, AdonisJS, TanStack Start, Express, Fastify, Elysia, NestJS, and Next.js projects.

## Core API

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
```

## Options

| Option | Description |
| --- | --- |
| `boss` | Optional `PgBoss` instance. Required for mutations. |
| `db` | Postgres connection string, `Pool`, or `Client`. Required for reads unless your adapter passes a compatible connection. |
| `schema` | pg-boss schema. Defaults to `pgboss`. |
| `auth` | Basic auth credentials. Required unless `allowUnauthenticated: true`. |
| `allowUnauthenticated` | Explicitly allow unprotected browsing. Defaults to `false`. |
| `readonly` | Disable all mutations. Defaults to `true` without auth, `false` with auth. |
| `allowManualEnqueue` | Enable manual enqueue and enqueue-copy actions. Defaults to `false`. |
| `allowQueueClean` | Enable queue clean preview only. Requires `boss`, writable mode, and route protection. Defaults to `false`. |
| `allowQueueCleanDelete` | Enable irreversible queue clean deletion. Requires exact confirmation, direct SQL safety, and route protection. Defaults to `false`. |
| `alerts` | Optional config-driven alert rules and contact points. Evaluation is read-only; delivery runners are opt-in. |
| `tags` | Fields from `job.data` that can be used as filters. |

## Alerting

Alerting is configured in `BossbenchOptions`, evaluated from pg-boss/Postgres data, and surfaced through the bundled Alerts page plus `/api/alerts`.

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
        id: "critical-failures",
        name: "Critical failures",
        type: "failed_count",
        windowMinutes: 10,
        threshold: 5,
        severity: "critical",
        cooldownMinutes: 30,
        contactPointIds: ["ops"],
      },
    ],
    contactPoints: [
      { id: "ops", name: "Ops", type: "discord", urlEnv: "OPS_DISCORD_WEBHOOK" },
    ],
  },
});
```

Rules support `failed_count`, `dead_letter_count`, `retry_backlog_count`, `oldest_created_age`, `avg_wait_ms`, `avg_duration_ms`, and `warning_count`. `oldest_created_age` thresholds are seconds; wait and duration thresholds are milliseconds. Contact points can be `webhook`, `slack`, or `discord`. Prefer `urlEnv` or server-only config for webhook URLs; the dashboard only receives masked contact point summaries.

`AlertRunner` is exported for server-side delivery. It does not start timers automatically; call `runOnce()` from one process or your own scheduler. In replicated deployments, run a single alert worker or add deployment-level locking before enabling delivery.

## Security

Bossbench requires non-empty `auth` by default. Use `allowUnauthenticated: true` only for local development or when another middleware protects the route. Without `auth`, Bossbench defaults to read-only mode.

Queue clean is split into preview and delete. `allowQueueClean` enables preview only, `allowQueueCleanDelete` enables irreversible deletion, and exact confirmation text is required before deletion runs. Queue clean targets pg-boss storage directly, so failed deletion removes the underlying dead-letter/retry evidence. It is batch-limited; repeat it while `hasMore` is true when draining large queues.

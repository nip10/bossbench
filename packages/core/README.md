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
| `allowQueueClean` | Enable queue clean capabilities when safety work lands. Defaults to `false`. |
| `tags` | Fields from `job.data` that can be used as filters. |

## Security

Bossbench requires non-empty `auth` by default. Use `allowUnauthenticated: true` only for local development or when another middleware protects the route. Without `auth`, Bossbench defaults to read-only mode.

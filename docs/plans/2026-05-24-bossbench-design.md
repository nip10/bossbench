# Bossbench design

Date: 2026-05-24

## Goal

Bossbench is a pg-boss-native dashboard inspired by Workbench. It should provide an embedded operations UI for Node applications using pg-boss, while avoiding BullMQ-specific concepts that do not map cleanly to pg-boss.

The project will use a hybrid approach: reuse Workbench's product and package shape as inspiration, but build the backend, data model, and API around pg-boss and Postgres.

## Package architecture

```txt
bossbench/
  packages/
    core/      # pg-boss domain, SQL repository, API router, bundled React UI
    hono/      # Hono adapter
    express/   # Express adapter
    cli/       # installer/scaffolder
  examples/
    hono/
    express/
  apps/
    web/       # marketing/docs site
```

### `@bossbench/core`

Core owns configuration, authentication-independent API behavior, the pg-boss read repository, mutation action service, API routes, and bundled React UI assets.

Core accepts:

```ts
interface BossbenchOptions {
  boss?: PgBoss
  db?: string | Pool | Client
  schema?: string
  auth?: {
    username: string
    password: string
  }
  title?: string
  logo?: string
  basePath?: string
  readonly?: boolean
  tags?: string[]
}
```

`schema` defaults to `"pgboss"` and must be validated/quoted as a Postgres identifier. SQL values must always be parameterized.

Core exports:

- `BossbenchCore`
- `createApiRoutes`
- shared response/domain types
- UI asset helpers

### `@bossbench/hono`

The Hono adapter exposes:

```ts
app.route("/jobs", bossbench({
  boss,
  db: process.env.DATABASE_URL!,
  schema: "pgboss",
  auth: {
    username: process.env.BOSSBENCH_USER!,
    password: process.env.BOSSBENCH_PASS!,
  },
}))
```

It handles basic auth, CORS where appropriate, static UI assets, `/config`, `/api/*`, and SPA fallback routing.

### `@bossbench/express`

The Express adapter exposes:

```ts
app.use("/jobs", bossbench({
  boss,
  db: process.env.DATABASE_URL!,
  schema: "pgboss",
}))
```

It should mirror the Hono adapter's behavior: auth, API mounting, static assets, and SPA fallback.

### `@bossbench/cli`

The CLI should:

- install the right packages
- detect Hono or Express projects
- add a route mount
- write `.env.example` entries
- optionally add local Postgres and pg-boss example configuration

## Core design decision

Bossbench uses a SQL-backed read model and pg-boss-backed actions.

Reads such as job lists, queue details, metrics, search, warnings, and dead-letter views come from direct Postgres queries against the configured pg-boss schema. Mutations such as retry, cancel, resume, delete, schedule, and unschedule use the provided pg-boss instance when available.

If no `boss` instance is provided, read-only browsing can still work. Mutation endpoints should return a clear error explaining that actions require a pg-boss instance.

## API design

Bossbench exposes a stable dashboard API that follows pg-boss terminology.

```txt
GET    /api/config
POST   /api/refresh

GET    /api/overview
GET    /api/queues
GET    /api/queues/:name
GET    /api/queues/:name/jobs

GET    /api/jobs
GET    /api/jobs/:id
POST   /api/jobs/:id/retry
POST   /api/jobs/:id/cancel
POST   /api/jobs/:id/resume
POST   /api/jobs/:id/delete

GET    /api/schedules
POST   /api/schedules
DELETE /api/schedules/:name

GET    /api/dead-letter
GET    /api/warnings
GET    /api/metrics
GET    /api/activity
GET    /api/search
GET    /api/tags/:field/values
```

Job states follow pg-boss terminology:

```ts
type BossbenchJobState =
  | "created"
  | "retry"
  | "active"
  | "completed"
  | "cancelled"
  | "failed"
```

The main job list supports:

- queue filter
- state filter
- text search
- practical JSON data search
- time range
- configured tag filters
- pagination
- sorting by fields such as `created_on`, `started_on`, `completed_on`, `priority`, `state`, and `name`

## Repository layer

Core uses a `BossbenchRepository` abstraction.

```ts
interface BossbenchRepository {
  getOverview(): Promise<OverviewStats>
  listQueues(): Promise<QueueInfo[]>
  getQueue(name: string): Promise<QueueDetail | null>
  listJobs(filters: JobFilters): Promise<PaginatedResponse<JobSummary>>
  getJob(id: string): Promise<JobDetail | null>
  getSchedules(): Promise<ScheduleInfo[]>
  getWarnings(filters: WarningFilters): Promise<PaginatedResponse<WarningInfo>>
  getMetrics(range: MetricsRange): Promise<MetricsResponse>
  getActivity(range: ActivityRange): Promise<ActivityResponse>
  getTagValues(field: string, limit: number): Promise<Array<string | number | boolean | null>>
}
```

The first implementation is a Postgres repository. It should keep SQL construction centralized, safely quote schema identifiers, parameterize values, and expose typed dashboard DTOs rather than leaking database rows directly to the UI.

## Action service

Mutations use a `PgBossActionService` backed by the user's pg-boss instance.

Initial actions:

- retry job
- cancel job
- resume cancelled job
- delete job
- create schedule
- remove schedule
- bulk retry/cancel/delete where safe

If `readonly` is true, every mutation endpoint returns `READONLY_MODE`. If `boss` is missing, every mutation endpoint returns `BOSS_INSTANCE_REQUIRED`.

## UI design

Bossbench should feel like a polished embedded ops dashboard, but use pg-boss concepts.

Main navigation:

```txt
Overview
Queues
Jobs
Schedules
Dead Letter
Warnings
Metrics
Activity
Settings
```

### Overview

Shows total jobs by state, failed/retry/active counts, recent throughput, slowest queues, dead-letter summary, and warning summary.

### Queues

Shows all queues with counts by state and queue-level stats. Queue detail pages show recent jobs and metrics for that queue.

### Jobs

Shows a global paginated job table with queue, state, date range, text, and tag filters. Job detail pages or drawers show data payload, output/result if available, retry metadata, timestamps, policy/dead-letter info, and a raw JSON view.

Safe bulk actions can include retry, cancel, and delete.

### Schedules

Shows schedules, supports creating schedules when a pg-boss instance exists, and supports unscheduling existing schedules. In read-only or browse-only mode, mutation controls are disabled with explanatory copy.

### Dead Letter

Focused exploration for failed/dead-letter jobs, with links back to source queue/job where possible.

### Warnings

Reads pg-boss warning persistence where available. Empty states should explain that warning data depends on `persistWarnings`.

### Metrics

Shows hourly/daily throughput, failures, retries, average duration where timestamps allow it, and queue wait time where timestamps allow it.

### Activity

Shows a best-effort activity timeline from job table timestamps. Worker views should only appear where pg-boss exposes useful `getWipData()` data. The UI must not imply pg-boss has a durable cluster-wide worker registry.

## UI constraints

- Default dark UI.
- Responsive enough for laptop and tablet usage.
- Avoid BullMQ terms such as flows, DAG, promote, and paused queue unless pg-boss supports a real equivalent.
- Read-only mode visibly disables mutating controls.
- If `boss` is missing, the dashboard becomes browse-only and explains why actions are disabled.

## Error handling

API errors use a consistent JSON shape:

```ts
{
  error: {
    code: string
    message: string
    details?: unknown
  }
}
```

Expected error codes:

- `DB_UNAVAILABLE`
- `BOSS_INSTANCE_REQUIRED`
- `JOB_NOT_FOUND`
- `QUEUE_NOT_FOUND`
- `READONLY_MODE`
- `INVALID_FILTER`
- `ACTION_FAILED`
- `UNSUPPORTED_FEATURE`

SQL errors must not leak raw connection strings, credentials, or full SQL text. Unsupported pg-boss features should degrade gracefully with explanatory empty states.

## Security

- Basic auth support in both Hono and Express adapters.
- Strong recommendation to run behind existing app auth in production.
- `readonly?: boolean` disables all mutation endpoints.
- Schema names are identifier-validated and quoted, never interpolated raw.
- Filter values use parameterized SQL.
- Payload search avoids unsafe JSON-path construction.
- `/api/config` exposes no secrets.

## Testing strategy

Unit tests:

- option normalization
- schema identifier handling
- SQL query builders
- API error mapping
- action service behavior with and without `boss`
- readonly enforcement

Integration tests:

- pg-boss schema fixtures in Postgres
- queues list
- jobs pagination/filtering/sorting
- job detail
- schedule listing
- warnings
- metrics aggregation
- action endpoints with mocked or real pg-boss

Adapter tests:

- Hono mount
- Express mount
- auth behavior
- static UI serving
- SPA fallback routing

Build checks:

- `bun run build`
- `bun run typecheck`
- `bun run lint`
- package smoke tests for ESM imports

## Initial scope

Bossbench v1 includes:

- Hono and Express adapters
- pg-boss instance plus direct Postgres connection support
- configurable schema name defaulting to `pgboss`
- queues, jobs, job detail, schedules, warnings, dead-letter, metrics, activity, and settings screens
- retry, cancel, resume, delete, schedule, and unschedule actions
- search, filtering, tags, sorting, and pagination
- CLI installer
- Hono and Express examples
- simple marketing/docs site

## Explicit non-goals

- BullMQ compatibility.
- Flow/DAG views.
- Queue pause/unpause unless pg-boss adds an equivalent.
- Durable worker registry unless pg-boss provides or Bossbench later adds explicit telemetry.
- Editing arbitrary job payloads or states.

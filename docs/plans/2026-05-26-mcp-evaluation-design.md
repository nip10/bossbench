# Bossbench MCP evaluation design

## Decision

Build `@bossbench/mcp`, but start with a read-only stdio server that proxies the existing Bossbench HTTP API. Do not connect to Postgres directly and do not mutate queues in the first release.

## Why

The upstream Workbench MCP package is useful because AI/editor agents can inspect queues without scraping the UI. Bossbench has the same opportunity for pg-boss operators, especially because we now have stable read endpoints for overview, queues, jobs, future jobs, schedules, dead-letter, warnings, metrics, and activity.

## First release scope

Package: `packages/mcp` / `@bossbench/mcp`

Transport: stdio only.

Configuration:

- `BOSSBENCH_URL` required, pointing at the mounted dashboard URL such as `http://localhost:3000/jobs`.
- `BOSSBENCH_USERNAME` / `BOSSBENCH_PASSWORD` optional for Basic Auth.
- `BOSSBENCH_TOKEN` optional Bearer token for proxy setups.

Read-only tools:

- `bossbench_get_overview` → `GET /overview`
- `bossbench_list_queues` → `GET /queues`
- `bossbench_list_jobs` → `GET /jobs`
- `bossbench_list_future_jobs` → `GET /future-jobs`
- `bossbench_get_job` → `GET /jobs/:id`
- `bossbench_search_jobs` → `GET /search`
- `bossbench_list_schedules` → `GET /schedules`
- `bossbench_list_dead_letters` → `GET /dead-letter`
- `bossbench_list_warnings` → `GET /warnings`
- `bossbench_get_metrics` → `GET /metrics`
- `bossbench_get_activity` → `GET /activity`
- `bossbench_get_status` → `GET /config`

## Later mutation scope

Mutation tools should be opt-in after read-only adoption:

- retry/cancel/resume/delete job
- create/delete schedule
- schedule run-now

They must preserve dashboard auth, readonly, and `BOSS_INSTANCE_REQUIRED` semantics. MCP must never write SQL directly.

## Implementation notes

Use the TypeScript MCP SDK stdio server. Register tools with Zod input schemas, `readOnlyHint: true`, `idempotentHint: true`, and compact JSON text plus structured content. Return API errors as tool-level `isError: true` results so agents can recover.

## Acceptance criteria for implementation PR

- New package builds with `tsup`.
- Client normalizes `BOSSBENCH_URL` and appends `/api` once.
- Auth headers support Basic and Bearer token.
- Tests cover URL normalization, auth headers, tool response truncation/error handling, and representative read-only tools.
- README includes Cursor/Claude/Zed config examples.

## Tracking

- GitHub issue: #39
- Upstream reference: `pontusab/workbench@a888bdc`

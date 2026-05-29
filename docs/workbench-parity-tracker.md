# Workbench parity tracker

Last updated: 2026-05-29

Last upstream audit: 2026-05-29, [`pontusab/workbench@4937b37`](https://github.com/pontusab/workbench/commit/4937b37) after previously checked [`e4bab1d`](https://github.com/pontusab/workbench/commit/e4bab1d).

This document tracks Bossbench parity with upstream Workbench. Bossbench is pg-boss/Postgres-native, so parity does **not** mean copying BullMQ-only behavior. Every Workbench capability should be classified as implemented, adapted to pg-boss, planned, or intentionally unsupported.

## Status definitions

| Status | Meaning |
| --- | --- |
| Implemented | Bossbench has equivalent or better behavior. |
| Adapted | Bossbench has a pg-boss-native equivalent with different terms/data. |
| Planned | Desired but not complete; tracked by an open issue. |
| Non-goal | Intentionally not planned because the Workbench concept is BullMQ-specific or unsafe for pg-boss. |
| Gap | Missing capability that should be tracked. |

## Current summary

Bossbench is now strong in job operations, job detail, future-job exploration, schedule actions, manual enqueue/requeue, metrics, adapters, CLI, MCP, examples, AI-search metadata, package/docs discoverability, and package release readiness. The largest remaining parity gaps versus current Workbench are destructive queue clean follow-up, deeper command-center polish, and desktop.

Open parity issues:

- [#59 pg-boss-safe queue clean semantics](https://github.com/nip10/bossbench/issues/59)
- [#14 Desktop parity](https://github.com/nip10/bossbench/issues/14)
- [#29 Desktop scaffold and onboarding](https://github.com/nip10/bossbench/issues/29)
- [#30 Desktop secure connection profile storage](https://github.com/nip10/bossbench/issues/30)
- [#31 Desktop pg-boss sidecar server](https://github.com/nip10/bossbench/issues/31)
- [#32 Desktop dashboard UI reuse](https://github.com/nip10/bossbench/issues/32)
- [#33 Desktop CI and release pipeline](https://github.com/nip10/bossbench/issues/33)
- [#34 Desktop smoke tests](https://github.com/nip10/bossbench/issues/34)

## Upstream audit log

| Date | Upstream range | New upstream work | Bossbench follow-up |
| --- | --- | --- | --- |
| 2026-05-26 | [`5e1bbf3..237beaf`](https://github.com/pontusab/workbench/compare/5e1bbf307f160661e8729611774e531df2d3abe7...237beaf) | Workbench 0.5.0 added scheduler **Run now**, fixed delayed-tab separation for scheduler next-runs, rendered future timestamps as `in Xs`, added `@getworkbench/mcp`, expanded AI-search/LLM docs (`llms.txt`, robots, JSON-LD, launch blog), and added Astro/Bun/h3/Koa/Nuxt adapters/examples. | Completed pg-boss-safe future timestamps, future jobs, schedule Run now, AI-search metadata, MCP design, adapter evaluation, and dashboard follow-through in PRs #42–#48. Remaining follow-up: build the actual read-only `@bossbench/mcp` package and implement h3 only if adapter expansion proceeds. |
| 2026-05-27 | [`237beaf..45f19ff`](https://github.com/pontusab/workbench/compare/237beaf...45f19ff) | Workbench 0.5.2 added a BullMQ job logs tab, app icon branding/static asset plumbing, queue popover scrolling, and dashboard/container layout fixes. | Ported container-safe shell height, scrollable queue shortcuts, and embedded app-icon plumbing. Tracked pg-boss-native timeline/events design separately in #53 because BullMQ `job.log()` does not map directly to pg-boss. |
| 2026-05-27 | [`45f19ff..e4bab1d`](https://github.com/pontusab/workbench/compare/45f19ff...e4bab1d) | Workbench 0.6.0 made Overview the command-center home with KPI cards, 24h throughput, attention alerts, queue health cards, collapsible sidebar, queue clean UI, failed-run reasons, and live cues. Workbench 0.7.0 added AdonisJS and TanStack Start adapters/examples/CLI scaffolds/site content. Current main also adds a standalone Bun Docker image and GHCR image workflow plus Docker marketing/docs. | Bossbench already has Overview as home, SQL-backed health signals, queue metrics, read-only MCP, and scrollable queue shortcuts, but lacks collapsible expanded sidebar, live cues, failed reason snippets, queue clean semantics, Adonis/TanStack Start adapters, and standalone Docker deployment. |
| 2026-05-29 | [`e4bab1d..4937b37`](https://github.com/pontusab/workbench/compare/e4bab1d...4937b37) | Workbench 0.7.1 improved bull-board alternative discoverability across npm/GitHub/site/package READMEs and polished `CopyCommand` overflow/scroll layout. | Completed Bossbench package metadata/README discoverability polish, root/package consistency updates, and copy-command overflow styling. |

When auditing upstream again, compare from the `Last upstream audit` commit above to `pontusab/workbench@main`, then append one row here and update the audit line.

## Dashboard UI and product surfaces

| Workbench capability | Bossbench status | Bossbench equivalent / rationale | Issue |
| --- | --- | --- | --- |
| Embedded dashboard shell | Adapted | Bossbench has shell/sidebar/header layout, but Workbench shell is still denser and more polished. | [#58](https://github.com/nip10/bossbench/issues/58) |
| Sidebar navigation | Adapted | Bossbench has icon sidebar, main sections, and scrollable queue shortcuts for large queue sets; Workbench now has a richer collapsible shadcn sidebar with expanded/collapsed modes and inline/collapsed queue affordances. | [#58](https://github.com/nip10/bossbench/issues/58) |
| Command palette | Adapted | Bossbench has route and queue navigation; Workbench command palette is richer. | [#9](https://github.com/nip10/bossbench/issues/9) |
| Header search | Implemented | Bossbench has global/job search integrated into Jobs. | — |
| Dark UI/theme toggle | Implemented | Bossbench supports dark/light dashboard theme. | — |
| Overview command center | Adapted | Bossbench uses Overview as home and now adds attention signals plus a live sync cue on top of queue/job/dead-letter/warning summaries, metrics-driven throughput, wait/duration, slowest queues, and failing queues. Workbench remains richer for worker/paused-queue health, per-queue cards, and deeper live cues. | [#58](https://github.com/nip10/bossbench/issues/58) |
| Queue overview cards/grid | Adapted | Bossbench has queue table and detail pages; Workbench queue cards are visually richer. | [#9](https://github.com/nip10/bossbench/issues/9) |
| Jobs/runs list | Implemented | Bossbench supports search, queue/state/date/tag filters, sorting, pagination, and bulk actions. | — |
| Bulk job actions | Adapted | Bossbench supports bulk retry/cancel/delete. Bulk promote is a BullMQ-only non-goal. | — |
| Job detail tabs | Adapted | Bossbench has summary, payload, output, timeline, raw tabs plus copy/export. Workbench also has BullMQ-specific logs/error detail that Bossbench adapts through pg-boss data. | [#12](https://github.com/nip10/bossbench/issues/12) |
| Job error/retry history detail | Gap | Bossbench exposes retry count/limit and output/raw data; Workbench has richer error/retry/timeline detail. | [#12](https://github.com/nip10/bossbench/issues/12) |
| Failed reason snippets in job lists | Implemented | Bossbench job summaries include safe, short failure snippets from pg-boss output and render them in job, queue, and dead-letter lists for failed jobs. | [#57](https://github.com/nip10/bossbench/issues/57) |
| Job clone/requeue | Adapted | Bossbench adds a safe Enqueue copy action on job detail, backed by `PgBoss.send()` and gated by `allowManualEnqueue`. | [#60](https://github.com/nip10/bossbench/issues/60) |
| Job timeline | Adapted | Bossbench has a pg-boss-native Timeline tab built from reliable job row data: created, start_after, started, terminal timestamp, retry count, and dead-letter presence. | — |
| Job logs tab | Adapted | Workbench reads BullMQ `job.log()` output. pg-boss has no direct equivalent, so Bossbench adapts this as a Timeline tab rather than inventing a fake log stream. | — |
| Manual test/enqueue page | Adapted | Bossbench adds a compact queue-level manual enqueue panel with JSON-object payload parsing, gated by `allowManualEnqueue`. | [#60](https://github.com/nip10/bossbench/issues/60) |
| Scheduler "Run now" | Adapted | Bossbench exposes a pg-boss-safe Run now action that enqueues one immediate job from schedule metadata through `PgBoss.send()` without changing the cron cadence. | — |
| Future timestamp copy | Implemented | Bossbench renders sub-day future relative times as `in Xs`, `in Xm`, and `in Xh`. | — |
| Queue pages | Adapted | Bossbench has queue list and queue detail with counts/recent jobs. Workbench queue pages include deeper tabs, job browsing, bulk actions, and queue controls. | [#9](https://github.com/nip10/bossbench/issues/9), [#12](https://github.com/nip10/bossbench/issues/12) |
| Schedulers/repeatables | Adapted | Bossbench uses pg-boss schedules instead of BullMQ repeatables. | [#12](https://github.com/nip10/bossbench/issues/12) |
| Delayed/future jobs | Adapted | Bossbench has a dedicated Future Jobs page for concrete pg-boss job rows with future `start_after` values, keeping schedule metadata separate. | — |
| Metrics dashboard | Adapted | Bossbench has summary cards, chart-style panels, and queue health tables. Workbench has BullMQ-specific slowest jobs and failing job types; Bossbench currently adapts these to queues. | [#11](https://github.com/nip10/bossbench/issues/11) |
| Activity timeline | Adapted | Bossbench has activity page; Workbench folds similar activity into runs/metrics views. | — |
| Settings/status page | Implemented | Bossbench has schema, readonly, boss presence, auth/tag guidance. | — |
| Flow/DAG views | Non-goal | BullMQ flows do not map cleanly to pg-boss. | — |

## Backend/API and data model

| Workbench capability | Bossbench status | Bossbench equivalent / rationale | Issue |
| --- | --- | --- | --- |
| Queue discovery from backend | Adapted | Bossbench derives queues from pg-boss job rows in Postgres. | — |
| `/api/overview` | Adapted | Bossbench overview is SQL-backed and pg-boss-native. | [#25](https://github.com/nip10/bossbench/issues/25) |
| `/api/counts` | Adapted | Bossbench exposes counts through overview, queues, and metrics rather than a dedicated counts endpoint. | — |
| `/api/runs` | Adapted | Bossbench uses `/jobs` with filters/pagination. | — |
| `/api/jobs/:queue/:id` | Adapted | Bossbench uses `/jobs/:id` and reads queue from the job row. | — |
| Delayed jobs API | Adapted | Bossbench exposes `/future-jobs` for concrete pg-boss jobs whose `start_after` is in the future. | — |
| Retry/remove/promote | Adapted | Bossbench supports retry/cancel/resume/delete. Promote has no pg-boss equivalent. | — |
| Bulk retry/delete/promote | Adapted | Bossbench supports bulk retry/cancel/delete. Bulk promote is a non-goal. | — |
| Queue pause/resume | Non-goal | pg-boss has no durable queue pause/resume equivalent. | — |
| Queue clean | Adapted | Bossbench implements a safe read-only clean preview gated by `allowQueueClean`; destructive delete remains blocked on direct SQL policy/table resolution. | [#59](https://github.com/nip10/bossbench/issues/59) |
| Search endpoint | Implemented | Bossbench `/search` delegates to SQL-backed job search. | — |
| Tag values endpoint | Implemented | Bossbench exposes configured JSONB tag values. | — |
| Metrics API | Adapted | Bossbench metrics are SQL-backed with summary, buckets, and queue health. Workbench's slowest/failing job-type metrics are adapted to pg-boss queue health. | [#11](https://github.com/nip10/bossbench/issues/11) |
| Activity API | Implemented | Bossbench exposes activity buckets from pg-boss timestamps. | — |
| Flow APIs | Non-goal | BullMQ-only concept. | — |
| Test/enqueue API | Adapted | Bossbench exposes pg-boss-safe manual enqueue and enqueue-copy APIs gated by `allowManualEnqueue`, using `PgBoss.send()` rather than direct SQL inserts. | [#60](https://github.com/nip10/bossbench/issues/60) |
| Scheduler run-now API | Adapted | Bossbench exposes `POST /schedules/:name/run-now`, looks up schedule metadata, and enqueues through pg-boss without mutating recurrence. | — |
| Read-only mutation guard | Implemented | Mutations return `READONLY_MODE` or `BOSS_INSTANCE_REQUIRED`. | — |
| Basic auth | Implemented | Bossbench requires auth unless `allowUnauthenticated: true`. | — |
| pg-boss schedules | Implemented | Bossbench adds `/schedules` and scheduler UI. | [#12](https://github.com/nip10/bossbench/issues/12) |
| pg-boss warnings | Implemented | Bossbench adds `/warnings` and warnings UI. This is a pg-boss-native extension beyond Workbench. | [#12](https://github.com/nip10/bossbench/issues/12) |
| pg-boss dead-letter/failure exploration | Adapted | Bossbench has dead-letter view; deeper modeling remains possible. This is a pg-boss-native extension beyond Workbench. | [#12](https://github.com/nip10/bossbench/issues/12) |

## pg-boss-native extensions beyond Workbench

| Bossbench capability | Status | Notes | Issue |
| --- | --- | --- | --- |
| Dedicated dead-letter page | Implemented | Workbench does not have a separate dead-letter page; Bossbench exposes failed/dead-letter exploration for pg-boss. | — |
| Dedicated warnings page | Implemented | Workbench does not have a warning persistence page; Bossbench exposes pg-boss warning data where available. | — |
| Settings/status page | Implemented | Shows schema, read-only state, `PgBoss` presence, and configured tags. | — |
| Read-only browse mode without `PgBoss` instance | Implemented | Bossbench can browse SQL data without mutations, with explicit disabled action states. | — |

## Ecosystem, docs, release, and desktop

| Workbench capability | Bossbench status | Bossbench equivalent / rationale | Issue |
| --- | --- | --- | --- |
| Hono adapter | Implemented | `@bossbench/hono`. | — |
| Express adapter | Implemented | `@bossbench/express`. | — |
| Fastify adapter | Implemented | `@bossbench/fastify`. | — |
| Elysia adapter | Implemented | `@bossbench/elysia`. | — |
| NestJS adapter | Implemented | `@bossbench/nestjs`. | — |
| Next.js adapter | Implemented | `@bossbench/next`. | — |
| AdonisJS adapter | Implemented | `@bossbench/adonis` provides `mountBossbench(router, mountPath, options)` plus CLI scaffold and example. | [#63](https://github.com/nip10/bossbench/issues/63) |
| TanStack Start adapter | Implemented | `@bossbench/tanstack-start` provides server-route handlers plus CLI scaffold and example. | [#64](https://github.com/nip10/bossbench/issues/64) |
| Astro adapter | Deferred | Workbench ships `@getworkbench/astro`; Bossbench should defer Astro unless user demand appears because it is less natural for an operational dashboard. | — |
| Bun adapter | Deferred | Workbench ships `@getworkbench/bun`; Bossbench should prefer examples first because Hono/Elysia already cover many Bun deployments. | — |
| h3 adapter | Implemented | Added first-party `@bossbench/h3` adapter and CLI detection/injection support. | [#61](https://github.com/nip10/bossbench/issues/61) |
| Koa adapter | Deferred | Workbench ships `@getworkbench/koa`; Bossbench should defer Koa unless requested. | — |
| Nuxt adapter | Implemented | `@bossbench/nuxt` wraps the h3 adapter for Nitro route files and ships CLI scaffold/example coverage. | [#62](https://github.com/nip10/bossbench/issues/62) |
| MCP server | Implemented | Bossbench ships `@bossbench/mcp`, a read-only stdio MCP server that proxies existing dashboard APIs. | — |
| CLI initializer | Adapted | Bossbench CLI detects supported frameworks and injects pg-boss/Postgres setup. Docs can be clearer. | [#13](https://github.com/nip10/bossbench/issues/13) |
| Framework examples | Implemented | Bossbench has `with-*` examples plus a seeded demo. | — |
| Standalone Docker deployment | Implemented | Bossbench now ships `apps/standalone` for connecting to an external pg-boss/Postgres database with read-only-first defaults and a Dockerfile. | [#56](https://github.com/nip10/bossbench/issues/56) |
| Marketing/docs site | Adapted | Bossbench has Workbench-style marketing site adapted to pg-boss plus `llms.txt`, AI-search robots policy, sitemap, JSON-LD, app-icon metadata, package discoverability metadata, expanded core README docs, and copy-command overflow polish. | [#68](https://github.com/nip10/bossbench/issues/68) |
| Smoke tests | Implemented | Bossbench smoke covers package entrypoints and optional demo checks. | — |
| CI | Implemented | Bossbench runs lint, commitlint, typecheck, tests, integration, build, and smoke. | — |
| npm release workflow | Implemented | Bossbench uses Changesets release workflow. | — |
| Desktop app | Planned | Workbench has Tauri desktop. Bossbench desktop is tracked as child issues #29–#34 because local implementation requires Rust/Tauri tooling and stricter Postgres safety controls. | [#14](https://github.com/nip10/bossbench/issues/14) |
| Desktop secure credential storage | Planned | Required for pg-boss/Postgres desktop safety; tracked by #30. | [#14](https://github.com/nip10/bossbench/issues/14) |
| Desktop read-only default | Planned | Required for safe Postgres desktop usage; tracked by #29/#31/#34. | [#14](https://github.com/nip10/bossbench/issues/14) |

## Remaining priority order

1. Decide whether to add destructive queue clean after preview: direct SQL policy, queue table resolution, and whether an audit log is required.
2. Deepen pg-boss job detail further: retry/error history and safe queue maintenance semantics.
3. Continue dashboard command-center polish: richer attention alerts, live cues, and optional collapsible sidebar behavior.
4. Continue desktop parity through [#14](https://github.com/nip10/bossbench/issues/14) and child issues [#29–#34](https://github.com/nip10/bossbench/issues?q=is%3Aissue%20state%3Aopen%20label%3Adesktop).

## Maintenance rule

Update this document whenever a Workbench parity issue is opened, closed, intentionally reclassified as a non-goal, or a new upstream audit is performed. For upstream audits, update `Last upstream audit` and append a row to `Upstream audit log` with the previous checked commit, new upstream head, grouped upstream changes, and Bossbench follow-ups.

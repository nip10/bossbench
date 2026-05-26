# Workbench parity tracker

Last updated: 2026-05-26

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

Bossbench is now strong in job operations, job detail, metrics, adapters, CLI, examples, and package release readiness. The largest remaining areas are dashboard shell polish, overview health signals, pg-boss data-model depth, ecosystem/docs polish, desktop, and maintaining this tracker as Workbench evolves.

Open parity issues:

- [#9 Dashboard UX parity with Workbench](https://github.com/nip10/bossbench/issues/9)
- [#11 Metrics and observability parity](https://github.com/nip10/bossbench/issues/11)
- [#12 pg-boss data model depth](https://github.com/nip10/bossbench/issues/12)
- [#13 CLI, examples, docs, and release polish](https://github.com/nip10/bossbench/issues/13)
- [#14 Desktop parity](https://github.com/nip10/bossbench/issues/14)
- [#25 Overview health signals](https://github.com/nip10/bossbench/issues/25)

## Dashboard UI and product surfaces

| Workbench capability | Bossbench status | Bossbench equivalent / rationale | Issue |
| --- | --- | --- | --- |
| Embedded dashboard shell | Adapted | Bossbench has shell/sidebar/header layout, but Workbench shell is still denser and more polished. | [#9](https://github.com/nip10/bossbench/issues/9) |
| Sidebar navigation | Adapted | Bossbench has icon sidebar and main sections; queue affordances are simpler than Workbench. | [#9](https://github.com/nip10/bossbench/issues/9) |
| Command palette | Adapted | Bossbench has route and queue navigation; Workbench command palette is richer. | [#9](https://github.com/nip10/bossbench/issues/9) |
| Header search | Implemented | Bossbench has global/job search integrated into Jobs. | — |
| Dark UI/theme toggle | Implemented | Bossbench supports dark/light dashboard theme. | — |
| Overview cards | Adapted | Bossbench shows queue/job/dead-letter/warning summaries; recent throughput and health signals need improvement. | [#25](https://github.com/nip10/bossbench/issues/25) |
| Queue overview cards/grid | Adapted | Bossbench has queue table and detail pages; Workbench queue cards are visually richer. | [#9](https://github.com/nip10/bossbench/issues/9) |
| Jobs/runs list | Implemented | Bossbench supports search, queue/state/date/tag filters, sorting, pagination, and bulk actions. | — |
| Bulk job actions | Adapted | Bossbench supports bulk retry/cancel/delete. Bulk promote is a BullMQ-only non-goal. | — |
| Job detail tabs | Adapted | Bossbench has summary, payload, output, raw tabs plus copy/export. Workbench also has error/retries/timeline views. | [#9](https://github.com/nip10/bossbench/issues/9), [#12](https://github.com/nip10/bossbench/issues/12) |
| Job error/retry history detail | Gap | Bossbench exposes retry count/limit and output/raw data; Workbench has richer error/retry/timeline detail. | [#12](https://github.com/nip10/bossbench/issues/12) |
| Job clone/requeue | Planned | Not implemented in the safe inspect/copy/export wave; requires pg-boss-specific manual enqueue/requeue design. | [#12](https://github.com/nip10/bossbench/issues/12) |
| Job timeline | Gap | Workbench has richer timeline/timing visualization; Bossbench has summary timestamps and metrics. | [#9](https://github.com/nip10/bossbench/issues/9) |
| Manual test/enqueue page | Planned | Workbench has a Test page/manual enqueue flow used by clone. Bossbench needs a pg-boss-safe design before adding this. | [#12](https://github.com/nip10/bossbench/issues/12) |
| Queue pages | Adapted | Bossbench has queue list and queue detail with counts/recent jobs. Workbench queue pages include deeper tabs, job browsing, bulk actions, and queue controls. | [#9](https://github.com/nip10/bossbench/issues/9), [#12](https://github.com/nip10/bossbench/issues/12) |
| Schedulers/repeatables | Adapted | Bossbench uses pg-boss schedules instead of BullMQ repeatables. | [#12](https://github.com/nip10/bossbench/issues/12) |
| Delayed/future jobs | Gap | Workbench exposes delayed jobs in its scheduler surface. Bossbench schedule management exists, but delayed/future job exploration is not yet a first-class surface. | [#12](https://github.com/nip10/bossbench/issues/12) |
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
| Delayed jobs API | Gap | Bossbench does not yet expose a dedicated delayed/future jobs API beyond schedule reads and job state/date filters. | [#12](https://github.com/nip10/bossbench/issues/12) |
| Retry/remove/promote | Adapted | Bossbench supports retry/cancel/resume/delete. Promote has no pg-boss equivalent. | — |
| Bulk retry/delete/promote | Adapted | Bossbench supports bulk retry/cancel/delete. Bulk promote is a non-goal. | — |
| Queue pause/resume | Non-goal | pg-boss has no durable queue pause/resume equivalent. | — |
| Queue clean | Gap | No pg-boss-native queue-clean equivalent has been designed. | [#12](https://github.com/nip10/bossbench/issues/12) |
| Search endpoint | Implemented | Bossbench `/search` delegates to SQL-backed job search. | — |
| Tag values endpoint | Implemented | Bossbench exposes configured JSONB tag values. | — |
| Metrics API | Adapted | Bossbench metrics are SQL-backed with summary, buckets, and queue health. Workbench's slowest/failing job-type metrics are adapted to pg-boss queue health. | [#11](https://github.com/nip10/bossbench/issues/11) |
| Activity API | Implemented | Bossbench exposes activity buckets from pg-boss timestamps. | — |
| Flow APIs | Non-goal | BullMQ-only concept. | — |
| Test/enqueue API | Planned | Workbench exposes test enqueue. Bossbench should only add this as a pg-boss-safe manual enqueue/requeue flow. | [#12](https://github.com/nip10/bossbench/issues/12) |
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
| CLI initializer | Adapted | Bossbench CLI detects supported frameworks and injects pg-boss/Postgres setup. Docs can be clearer. | [#13](https://github.com/nip10/bossbench/issues/13) |
| Framework examples | Implemented | Bossbench has `with-*` examples plus a seeded demo. | — |
| Marketing/docs site | Implemented | Bossbench has Workbench-style marketing site adapted to pg-boss. | [#13](https://github.com/nip10/bossbench/issues/13) |
| Smoke tests | Implemented | Bossbench smoke covers package entrypoints and optional demo checks. | — |
| CI | Implemented | Bossbench runs lint, commitlint, typecheck, tests, integration, build, and smoke. | — |
| npm release workflow | Implemented | Bossbench uses Changesets release workflow. | — |
| Desktop app | Planned | Workbench has Tauri desktop. Bossbench tracks desktop as a post-package milestone. | [#14](https://github.com/nip10/bossbench/issues/14) |
| Desktop secure credential storage | Planned | Required for pg-boss/Postgres desktop safety. | [#14](https://github.com/nip10/bossbench/issues/14) |
| Desktop read-only default | Planned | Required for safe Postgres desktop usage. | [#14](https://github.com/nip10/bossbench/issues/14) |

## Remaining priority order

1. [#25 Overview health signals](https://github.com/nip10/bossbench/issues/25) — small, high-leverage follow-up to the metrics work.
2. [#9 Dashboard UX parity](https://github.com/nip10/bossbench/issues/9) — shell/sidebar/command palette polish.
3. [#12 pg-boss data model depth](https://github.com/nip10/bossbench/issues/12) — schedules, warnings, dead-letter, queue maintenance semantics.
4. [#13 CLI/examples/docs/release polish](https://github.com/nip10/bossbench/issues/13) — public readiness.
5. [#14 Desktop parity](https://github.com/nip10/bossbench/issues/14) — larger product/security track.

## Maintenance rule

Update this document whenever a Workbench parity issue is opened, closed, or intentionally reclassified as a non-goal.

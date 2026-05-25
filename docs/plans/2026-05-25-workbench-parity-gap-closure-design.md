# Workbench parity gap closure design

Date: 2026-05-25

## Goal

Bring Bossbench to equal-or-better product quality than upstream Workbench while preserving pg-boss-native behavior. Bossbench should not copy BullMQ-only concepts blindly, but every Workbench capability should have one of these outcomes:

- a pg-boss-native equivalent,
- a clearly better pg-boss-specific replacement, or
- an explicit documented non-goal with rationale.

The first focus is dashboard feature depth. Package architecture, adapters, CLI, examples, CI, smoke checks, and the marketing site are already close to or ahead of Workbench. The largest gaps are dashboard UX, job operations, metrics/observability, and data-model depth.

## Issue structure

Create GitHub issues as epics plus concrete implementation tasks. The issue set should be readable as a roadmap and usable by parallel sub-agents.

### Epic 1: Dashboard UX parity with Workbench

Objective: make the embedded dashboard feel as polished and efficient as Workbench.

Tasks:

- Refactor the dashboard shell toward Workbench-quality layout and interaction density.
- Upgrade sidebar queue affordances where pg-boss data supports it.
- Upgrade command palette with navigation, queues, jobs, tag values, and theme actions.
- Improve visual tokens, spacing, status colors, tables, cards, and responsive behavior.
- Preserve pg-boss terminology and avoid BullMQ-only labels.

### Epic 2: Job browsing and actions parity

Objective: make jobs the strongest operational surface in Bossbench.

Tasks:

- Add advanced job filters: queue, state, date range, search, and configured tags.
- Add real pagination or infinite browsing.
- Add bulk retry, cancel, and delete where pg-boss semantics are safe.
- Add richer job detail tabs: summary, payload, output, raw, retry/dead-letter metadata.
- Add copy/export actions for job payload, output, and raw JSON.
- Add confirmation and disabled-state copy for destructive or unavailable actions.

### Epic 3: Metrics and observability parity

Objective: replace MVP bars with useful operational observability.

Tasks:

- Add chart-first throughput, failure, retry, duration, and wait-time views.
- Add slowest queues and failing queues tables.
- Improve overview with recent throughput and health signals.
- Add queue-scoped metrics where practical.
- Keep SQL aggregation safe, bounded, and index-conscious.

### Epic 4: pg-boss data model depth

Objective: expose pg-boss-specific concepts better than a generic queue dashboard.

Tasks:

- Improve dead-letter modeling beyond a simple failed-jobs list.
- Improve schedule creation and inspection with data/options/timezone where pg-boss supports them.
- Improve warnings UX and documentation around warning persistence.
- Expand repository/API DTOs and tests for richer metadata.

### Epic 5: CLI, examples, docs, and release polish

Objective: remove release/readiness drift and make the ecosystem feel production-grade.

Tasks:

- Fix README package metadata drift.
- Ensure all adapters are represented in package lists, examples, changesets, and smoke checks.
- Strengthen docs for auth, read-only mode, production deployment, and pg-boss/Postgres safety.
- Keep the seeded demo and examples aligned with new UI/API capabilities.

### Epic 6: Desktop parity

Objective: track Workbench desktop parity without compromising package release quality or database safety.

Tasks:

- Design desktop onboarding for Postgres URL, schema, and connection profiles.
- Default every new desktop connection to read-only.
- Store credentials only in platform secure storage.
- Warn on non-local database hosts.
- Reuse the existing dashboard UI bundle and core API.
- Add desktop CI/release tracking when implementation starts.

### Epic 7: Workbench parity audit tracker

Objective: keep a single source of truth for equal-or-better parity.

Tasks:

- Map upstream Workbench routes, components, and product flows to Bossbench equivalents.
- Mark each item as implemented, adapted, planned, or intentionally unsupported.
- Define acceptance criteria for “equal or better” at the dashboard level.

## First implementation wave

Start with Epic 2: Job browsing and actions parity.

Rationale:

- Jobs are the core operational workflow.
- Bossbench already has backend filters and individual job actions, so the first wave can produce visible impact quickly.
- Work can be split safely across backend/API, UI/UX, and tests.

Scope for the first wave:

1. Add client/API support for tag filters that the server already parses.
2. Add queue, date range, and configured tag filter controls to the Jobs page.
3. Add pagination controls using existing `limit` and `offset` support.
4. Add bulk action endpoints and UI for retry/cancel/delete when actions are enabled.
5. Add tests for filter serialization, API parsing, repository behavior, and action gating.

Out of scope for the first wave:

- Desktop implementation.
- Flow/DAG views.
- Queue pause/resume unless a real pg-boss equivalent is defined.
- Arbitrary job payload/state editing.

## Data flow

The job browsing flow remains:

```txt
UI filter state
  -> client API query serialization
  -> /api/jobs query parsing
  -> BossbenchRepository SQL filters
  -> PaginatedResponse<JobSummary>
  -> Jobs table and pagination controls
```

Bulk actions should follow:

```txt
selected job IDs
  -> bulk mutation endpoint
  -> load jobs to determine queues/names
  -> PgBossActionService per-job action
  -> per-job result summary
  -> UI action toast/banner and query invalidation
```

Bulk action responses should report partial failures instead of hiding them.

## Error handling

- Read filters continue using `INVALID_FILTER` for invalid state, tag field, date, sort, or pagination input.
- Mutations continue returning `READONLY_MODE` and `BOSS_INSTANCE_REQUIRED` when unavailable.
- Bulk mutations should return a structured result with `succeeded`, `failed`, and per-job error details.
- Destructive bulk delete requires confirmation in the UI.

## Testing

First-wave tests should cover:

- client query serialization for queue, state, search, dates, sort, offset, limit, and tags;
- API parsing for repeated tag values;
- repository filtering with configured tags;
- readonly and missing-boss behavior for bulk endpoints;
- UI state behavior for filters, pagination, selection, and disabled actions;
- smoke test remains green after route/API additions.

## Success criteria

The first wave is complete when:

- the Jobs page supports the same practical browsing controls expected from Workbench-level operations;
- configured pg-boss tags are usable from the UI;
- operators can select multiple jobs and run safe bulk actions;
- pagination is usable without editing query params manually;
- all new behavior is tested;
- `bun run lint`, `bun run typecheck`, `bun run test`, and relevant integration/smoke checks pass.

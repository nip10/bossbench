# Command-center overview and live cues design

Date: 2026-06-21

Related tracker: `docs/workbench-parity-tracker.md` dashboard shell, overview command center, queue overview cards/grid, and remaining command-center polish priority.

## Context

Bossbench already uses Overview as the dashboard home and has a compact command-center foundation: summary cards, attention signals, health metrics, queue counts, slowest/failing queue tables, a header refresh cue, sidebar queue shortcuts, and a functional command palette.

The remaining Workbench parity gap is not a wholesale rewrite. Bossbench should make the existing Overview feel more like an operational command center while staying pg-boss/Postgres-native. This wave should improve visible live status, queue health scanning, and empty/error states without adding backend endpoints or copying BullMQ-only concepts such as worker registries, paused queues, or QueueEvents-driven live streams.

## Goal

Improve the Overview page so operators can quickly answer:

- Is the dashboard live, loading metrics, using cached health data, or missing health data?
- Which queues deserve attention right now?
- Which queues are slow, failing, retry-heavy, or quiet?
- Where should I click next to inspect the queue or jobs?

## Non-goals

- Do not add backend endpoints or database queries.
- Do not add a worker registry, paused-queue health, BullMQ events, websockets, or polling infrastructure.
- Do not redesign the whole shell, command palette, or sidebar in this wave.
- Do not remove the existing dense queue table; operators still need exact counts.
- Do not add a chart library or new UI dependency.

## Approach

Use existing data sources:

- `useOverview()` for state totals, queue counts, dead-letter count, and warnings;
- `useMetrics()` for throughput, error rate, wait/duration, and queue health;
- React Query cache timestamps already used by `dashboardRefreshCue()`;
- existing `OverviewStats`, `MetricsResponse`, `QueueInfo`, and `QueueMetricSummary` types.

Add pure helper functions in `packages/core/src/ui/lib/dashboard-polish.ts` for derived UI data:

- overview live status copy and tone;
- queue health card summaries;
- queue health tone derivation;
- metrics loading/error/cached empty-state copy.

Keep rendering in `OverviewPage` in `packages/core/src/ui/pages.tsx`. Add CSS in `packages/core/src/ui/styles/globals.css` using the existing panel/card style language.

## UI design

### Live command-center strip

Add a compact strip near the top of Overview, below the top summary cards or between the summary cards and Attention section.

It should show:

- live/synced copy from existing cache timestamps;
- health signal state: loading, current, unavailable, or showing cached metrics;
- concise operator copy, for example “Overview loaded; health metrics are current” or “Health metrics unavailable; showing queue counts only.”

Use text plus tone classes. Do not rely on color alone.

### Queue health cards

Add a visual queue health card grid before the dense queue table.

Each card should include:

- queue name linked to queue detail;
- current counts from `OverviewStats.queues`: created, retry, active, failed;
- metrics when available: error rate, average wait, average duration;
- a short health label such as “Failing”, “Retry backlog”, “Slow”, “Busy”, or “Quiet”.

Card ordering should prioritize operator attention:

1. failed jobs and high error rate;
2. retry backlog;
3. active/created backlog;
4. slow wait/duration;
5. alphabetical fallback.

Limit the visual grid to a small number such as six cards to keep Overview scannable. The existing table remains below it for full queue counts.

### Existing sections

Keep the current sections:

- top summary cards;
- Attention signals;
- Health signals summary cards;
- queue table;
- slowest/failing queue tables.

The new queue cards should supplement the current tables, not replace them.

## Data flow

1. `OverviewPage` loads `overview` and `metricsData` as it does today.
2. Helper functions derive live status and queue card data from existing in-memory values.
3. Overview renders a live strip and queue card grid when data is available.
4. If metrics are loading or unavailable, queue cards still render using overview counts with clear fallback copy.
5. Queue card links route to existing queue detail pages.

## Error handling and safety

- If Overview fails, keep the existing page-level error state.
- If Metrics fails but Overview succeeds, keep Overview visible and show a compact health notice.
- If Metrics is loading, show that health signals are loading without blanking queue counts.
- If there are no queues, show a compact empty state.
- If metric fields are null, render `—` or existing formatting helpers rather than inventing values.
- Avoid overclaiming live streaming; use “synced” and “cached” language rather than “streaming”.

## Testing

Add focused tests in `packages/core/src/ui/lib/dashboard-polish.test.ts` for pure helpers:

- live status copy for live/current/loading/error/cached states;
- queue health card ordering;
- queue health tone/label derivation;
- fallback behavior when metrics are missing;
- empty queue behavior.

Run:

- `bun run --filter=@bossbench/core test -- src/ui/lib/dashboard-polish.test.ts`
- `bun run --filter=@bossbench/core test`
- `bun run --filter=@bossbench/core typecheck`
- `bun run --filter=@bossbench/core lint`
- `npx react-doctor@latest --verbose --scope changed`

## Success criteria

- Overview has a clear live/status strip that distinguishes current, loading, unavailable, and cached health data.
- Operators can scan a small set of visual queue health cards before dropping into dense tables.
- Queue cards link to existing queue detail pages.
- Existing summary cards, attention cards, health summary cards, and queue tables remain available.
- The implementation stays frontend-only and pg-boss-native.

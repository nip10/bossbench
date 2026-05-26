# Overview health signals design

Date: 2026-05-26

## Goal

Improve Bossbench Overview so operators see queue health and recent throughput before drilling into Metrics. This closes issue #25 and advances the remaining Metrics parity epic #11.

## Scope

Use existing dashboard APIs:

- `useOverview()` for totals, queue counts, dead-letter, and warnings;
- `useMetrics()` for throughput, error rate, wait/duration, and queue health.

Do not add backend endpoints in this wave.

## UI design

Overview should add a health section below the top summary cards:

- Throughput: jobs/hour from metrics summary.
- Error rate: failed terminal jobs / completed+failed.
- Avg wait: queue delay.
- Avg duration: processing time.

Then add a compact queue health section:

- Slowest queues by average duration.
- Failing queues by failure count/error rate.

If metrics are loading, keep Overview visible and show a small loading state for health. If metrics fail but Overview succeeds, show a compact warning rather than replacing the whole page.

## Non-goals

- Full Overview redesign.
- Backend metric changes.
- New chart library.
- Worker registry or desktop observability.

## Success criteria

- Overview surfaces throughput, error rate, avg wait, and avg duration.
- Overview lists the top slow/failing queues when metrics are available.
- Overview remains usable if metrics are unavailable.
- Existing queue count table remains present.

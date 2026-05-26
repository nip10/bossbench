# Schedule and future jobs separation design

## Goal

Separate pg-boss schedule metadata from concrete future job rows so Bossbench does not blur cron schedules with jobs that are delayed until a future `start_after` time.

## Scope

This slice implements the backend/API foundation for issue #37. It adds a read-only future-jobs query surface and preserves the existing schedules page/API. A later UI slice can add a dedicated route and navigation item using the new API.

## Design

Bossbench should treat these as separate concepts:

- **Schedules**: rows from the pg-boss `schedule` table. These describe recurring enqueue rules and continue to be returned by `/schedules`.
- **Future jobs**: rows from the pg-boss `job` table where `start_after > now()` and `state in ('created', 'retry')`. These are concrete jobs that are not eligible to run yet.

The first backend slice adds:

- `startAfter` to job summaries so clients can explain when a job becomes eligible;
- `future?: boolean` to internal query filters;
- `BossbenchRepository.listFutureJobs()` as a dedicated read method;
- `GET /future-jobs` as a dedicated API endpoint that reuses standard job filters but defaults sorting to `start_after:asc`.
- `api.futureJobs()` and `useFutureJobs()` as client-side foundation for a later dedicated page.

This deliberately avoids inferring schedule next-runs from schedule metadata. If pg-boss creates future job rows for scheduled executions, those rows appear only because they are concrete jobs.

## Testing

Use TDD with two focused test layers:

1. Repository unit coverage with a fake `pg` client proving the SQL filters `start_after > now()` and created/retry states and maps `startAfter`.
2. API route coverage proving `/future-jobs` calls the dedicated repository method with parsed filters.
3. UI API client coverage proving `api.futureJobs()` calls the dedicated endpoint with standard job query serialization.

## Tracking

- GitHub issue: #37
- Upstream reference: `pontusab/workbench@fa7ab94`

# Schedule Run Now design

## Goal

Add a pg-boss-safe “Run now” action for schedules that enqueues one immediate job without changing the schedule cadence.

## Scope

This slice implements backend/API/client foundations for issue #38. UI wiring can follow once the mutation contract is stable.

## Design

Bossbench schedules are pg-boss schedule metadata. “Run now” should not edit that metadata. The server should:

1. Look up the schedule by name from the existing `/schedules` data source.
2. Return `SCHEDULE_NOT_FOUND` if the schedule no longer exists.
3. Call a new action service method that uses `PgBoss.send(name, data, options)` to enqueue one immediate job.
4. Preserve existing mutation guards: readonly mode and missing `PgBoss` instance still block the action.
5. Return the created job id as `{ id }`.

This deliberately does not call `schedule()` because that would create/update recurring cadence. It also does not write directly to Postgres.

## Testing

Use TDD at three layers:

- action service test proving `runScheduleNow()` calls `boss.send()` with schedule data/options;
- API route test proving `POST /schedules/:name/run-now` looks up the schedule and calls the action;
- UI API client test proving `api.runScheduleNow()` posts to the dedicated endpoint.

## Tracking

- GitHub issue: #38
- Upstream reference: `pontusab/workbench@285aa41`

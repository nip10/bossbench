# Dashboard follow-through design

## Goal

Expose the upstream-port backend/API work for future jobs and schedule run-now in the Bossbench dashboard.

## Design

- Add a dedicated **Future Jobs** route and nav item. This page lists concrete pg-boss job rows returned by `/future-jobs` and explains that schedules remain separate metadata.
- Keep the page read-only: no bulk actions, only filters, pagination, sorting, and job-detail links.
- Add **Run now** to each schedule row. It calls the existing `api.runScheduleNow()` client method, reports the enqueued job id, and disables all schedule actions while a mutation is in flight to avoid duplicate enqueue races.
- Mark **Unschedule** as destructive styling while keeping Run now neutral.

## Tracking

- Follows up #37 and #38.

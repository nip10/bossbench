# Queue clean delete design

Date: 2026-06-04

Issue: [#59](https://github.com/nip10/bossbench/issues/59)

## Context

Bossbench currently supports queue-clean preview only. Preview is gated by `allowQueueClean`, writable mode, a connected `PgBoss` instance, and server-side validation. Preview uses safe read queries against the pg-boss `job` table and shows which completed or failed rows would match cleanup criteria.

Workbench exposes destructive queue clean actions. Bossbench can adapt that capability, but it must not silently turn existing preview-enabled deployments into destructive deployments. pg-boss does not expose an API that matches Bossbench's intended state, age, and limit semantics, so destructive clean requires a carefully constrained direct SQL operation.

## Goals

- Add destructive queue clean for `completed` and `failed` pg-boss jobs.
- Keep existing `allowQueueClean` preview-only behavior unchanged.
- Require a second explicit default-false destructive flag.
- Keep preview and delete separate in the API and UI.
- Use atomic, parameterized SQL against the quoted pg-boss parent `job` table.
- Emit a structured audit event for every destructive delete attempt/result.
- Make irreversible deletion copy unavoidable in the UI and docs.

## Non-goals

- No deletion of `created`, `retry`, `active`, or `cancelled` jobs.
- No “clean all terminal jobs” action.
- No automatic cleanup schedules.
- No MCP mutation tools.
- No dynamic queue-specific table-name resolution.
- No use of `pg-boss.deleteStoredJobs()` because it is too broad.
- No persistent Bossbench audit table in this wave.

## Capability flags and guards

Keep `allowQueueClean` as the preview flag.

Add:

```ts
allowQueueCleanDelete?: boolean;
```

It defaults to `false`.

Deletion requires all of:

- `readonly === false`;
- attached `PgBoss` instance;
- `allowQueueClean === true`;
- `allowQueueCleanDelete === true`;
- authenticated or otherwise protected deployment, as already required by Bossbench's auth model.

Add an action guard:

```ts
ensureQueueCleanDeleteAvailable()
```

This guard must fail before repository mutation when any requirement is missing.

## API design

Keep preview as-is:

```http
POST /api/queues/:name/clean-preview
```

Add a separate destructive endpoint:

```http
POST /api/queues/:name/clean
```

Request:

```ts
type QueueCleanDeleteRequest = {
  state: "completed" | "failed";
  cutoff: string;
  limit?: number;
  confirm: string;
};
```

Rules:

- `state` must be `completed` or `failed`.
- `cutoff` must be a valid ISO timestamp.
- `cutoff` must be at least 3600 seconds in the past.
- `limit` defaults to `1000` and caps at `5000`.
- `confirm` must exactly equal `clean <state> <queue>`.
- `cutoff` is passed from preview rather than recomputed from `olderThanSeconds`, so users do not preview one eligibility set and delete a newer one later.

Response:

```ts
type QueueCleanDeleteResult = {
  queue: string;
  state: "completed" | "failed";
  cutoff: string;
  deleted: number;
  deletedIds: string[];
  hasMore: boolean;
};
```

## SQL design

Use direct SQL only against the quoted pg-boss parent table:

```ts
quoteQualifiedIdentifier(schema, "job")
```

Do not resolve or interpolate queue-specific table names. Deleting from the parent table with `name = $1` lets Postgres route to partitions while avoiding destructive dynamic table-name resolution.

Use one atomic SQL statement:

```sql
with doomed as (
  select j.id, j.completed_on
  from <schema>.job j
  where j.name = $1
    and j.state = $2
    and j.completed_on is not null
    and j.completed_on < $3::timestamptz
  order by j.completed_on asc, j.id asc
  limit $4
  for update of j skip locked
), deleted as (
  delete from <schema>.job j
  using doomed d
  where j.name = $1
    and j.id = d.id
    and j.state = $2
    and j.completed_on is not null
    and j.completed_on < $3::timestamptz
  returning j.id::text, j.completed_on
)
select
  count(*)::int as "deleted",
  coalesce(array_agg(id order by completed_on asc, id asc), '{}'::text[]) as "deletedIds",
  exists (
    select 1
    from <schema>.job j
    where j.name = $1
      and j.state = $2
      and j.completed_on is not null
      and j.completed_on < $3::timestamptz
  ) as "hasMore"
from deleted;
```

Important constraints:

- All values are parameters.
- The state and cutoff predicates are rechecked in the `DELETE` clause.
- `completed_on IS NOT NULL` is mandatory.
- `FOR UPDATE SKIP LOCKED` avoids waiting on concurrent pg-boss or admin work.
- The statement is atomic; do not implement multi-statement `BEGIN`/`COMMIT` using `Pool.query()` because it does not pin a connection.

## Audit event design

Add an optional hook:

```ts
onAuditEvent?: (event: BossbenchAuditEvent) => void | Promise<void>;
```

For delete attempts, emit:

```ts
type BossbenchAuditEvent = {
  type: "queue.clean.delete";
  at: string;
  queue: string;
  state: "completed" | "failed";
  cutoff: string;
  limit: number;
  deleted: number;
  deletedIds: string[];
  hasMore: boolean;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
};
```

Audit hook failures should not hide a successful database deletion. If the hook throws after deletion, log or surface the audit error in the API response metadata only if the response shape is explicitly extended. The first implementation can test that successful deletes emit the event and validation failures do not mutate data.

## UI design

Keep the queue page preview panel. Add the destructive delete controls below preview results only when `config.allowQueueCleanDelete` is true.

Delete UI requirements:

- It is hidden or disabled unless preview succeeded.
- It uses the preview result's `queue`, `state`, `cutoff`, and current/preview `limit`.
- It requires exact confirmation text: `clean <state> <queue>`.
- The delete button stays disabled until confirmation matches.
- While deletion is running, preview and delete controls are disabled.
- Results show deleted count, deleted IDs, cutoff, and whether more jobs remain.

Failed-job warning copy:

> This permanently deletes failed pg-boss job rows from Postgres. Deleted jobs disappear from Dead Letter, metrics, timelines, and cannot be retried.

Completed-job warning copy:

> This permanently deletes completed pg-boss job rows from Postgres. Deleted jobs disappear from historical job lists and metrics.

## Error handling

Return request-level errors for:

- readonly mode;
- missing `PgBoss` instance;
- preview flag disabled;
- destructive flag disabled;
- invalid state;
- invalid cutoff;
- cutoff newer than one hour ago;
- invalid limit;
- confirmation mismatch.

Use existing error sanitization patterns and existing action error code style.

## Testing

Unit tests:

- option default and config exposure for `allowQueueCleanDelete`;
- action guard behavior for readonly, missing boss, preview flag disabled, destructive flag disabled;
- request validation and confirmation matching;
- repository SQL shape and result mapping;
- audit event emission on successful delete;
- UI disabled states and client API request shape where existing test patterns allow.

Integration tests:

- completed-only deletion;
- failed-only deletion;
- no deletion of `created`, `retry`, `active`, or `cancelled`;
- cutoff enforcement;
- limit and `hasMore` behavior;
- confirmation failure;
- guard failures.

## Documentation

Update root and core READMEs to clarify:

- `allowQueueClean` enables preview only;
- `allowQueueCleanDelete` enables irreversible deletion;
- delete uses direct SQL against pg-boss storage;
- cleanup is batch-limited and must be repeated while `hasMore` is true;
- failed-job deletion removes retry/dead-letter evidence.

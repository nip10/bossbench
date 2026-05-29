# Queue clean and manual enqueue safety design

Date: 2026-05-27

Issues: [#59](https://github.com/nip10/bossbench/issues/59), [#60](https://github.com/nip10/bossbench/issues/60)

## Context

Workbench exposes BullMQ queue-clean and test enqueue flows. Bossbench needs pg-boss-native equivalents that preserve data integrity and do not silently expose destructive or production-write features in existing deployments.

Current Bossbench mutation behavior is centralized in `PgBossActionService`, guarded by read-only mode and the presence of a `PgBoss` instance. Existing mutations use pg-boss APIs for retry, cancel, resume, delete, schedules, and schedule run-now. This design keeps that model and adds stricter capability flags for higher-risk operations.

## Shared safety model

Add explicit capability flags to `BossbenchOptions`:

- `allowQueueClean?: boolean` defaults to `false`.
- `allowManualEnqueue?: boolean` defaults to `false`.

These flags are necessary but not sufficient. Queue clean and manual enqueue also require:

- authenticated or explicitly protected deployment;
- `readonly === false`;
- attached `PgBoss` instance;
- server-side validation.

This avoids a package upgrade silently enabling destructive cleanup or arbitrary enqueue in a dashboard that was already writable for retry/delete/schedule actions.

## Queue clean semantics

Use the UI labels **Clean completed jobs** and **Clean failed jobs**. Internally, treat this as **purging terminal pg-boss job rows**.

Supported states:

- `completed`
- `failed`

Unsupported states:

- `created`
- `retry`
- `active`
- `cancelled`

Cleaning failed jobs is especially destructive because failed jobs disappear from Dead Letter, metrics, timeline, failure snippets, and can no longer be retried.

### Queue clean request

```ts
type QueueCleanRequest = {
  state: "completed" | "failed";
  olderThanSeconds: number;
  limit?: number;
  mode: "preview" | "delete";
  confirm?: string;
};
```

Rules:

- `olderThanSeconds` is required.
- Minimum `olderThanSeconds` is `3600`.
- Default `limit` is `1000`; maximum `limit` is `5000`.
- Match on `completed_on`; never delete rows with `completed_on IS NULL`.
- `mode: "preview"` returns count/sample IDs without deleting.
- `mode: "delete"` requires typed confirmation: `clean <state> <queue>`.
- Return deletion count, sample IDs, cutoff timestamp, and `hasMore`.

Recommended response:

```ts
type QueueCleanResult = {
  queue: string;
  state: "completed" | "failed";
  cutoff: string;
  matched?: number;
  deleted: number;
  hasMore: boolean;
  sampleIds: string[];
};
```

### Implementation direction

Do not use pg-boss `deleteStoredJobs()` for this feature. It deletes completed, failed, and cancelled jobs with no age or limit guard, which is too broad for Bossbench UI labels.

If implemented, use a narrow SQL delete because pg-boss does not expose a precise API for `completed`-only or `failed`-only cleanup with age and limit predicates. The SQL must be constrained, parameterized, and atomic:

```sql
with doomed as (
  select id
  from <schema>.<queue_table>
  where name = $1
    and state = $2
    and completed_on is not null
    and completed_on < now() - ($3::int * interval '1 second')
  order by completed_on asc
  limit $4
  for update skip locked
),
deleted as (
  delete from <schema>.<queue_table> j
  using doomed
  where j.id = doomed.id
    and j.name = $1
    and j.state = $2
  returning j.id
)
select id from deleted;
```

Before implementation, confirm how to resolve pg-boss queue tables safely for partitioned or queue-specific tables. If table resolution cannot be made reliable, keep #59 design-only and do not ship queue clean.

## Manual enqueue semantics

Manual enqueue creates a new pg-boss job through `PgBoss.send()`. It must never insert directly into pg-boss tables.

Endpoint:

```http
POST /api/queues/:name/enqueue
```

Request:

```ts
type EnqueueJobRequest = {
  data?: Record<string, unknown> | null;
  options?: {
    priority?: number;
    startAfter?: string | number;
  };
};
```

Validation:

- `allowManualEnqueue` must be enabled.
- Queue must exist unless future work explicitly supports creating new queues.
- `data` must be a JSON object or `null`.
- Reject arrays/scalars as payload roots for MVP.
- Serialized payload size must stay within a documented limit, e.g. 256 KiB.
- `priority` must be an integer if provided.
- `startAfter` accepts an ISO date or positive seconds delay.
- Caller-supplied job IDs are not allowed.
- Arbitrary pg-boss options are not passed through in MVP.

Response:

```ts
type EnqueueResult = {
  id: string | null;
  enqueued: boolean;
};
```

If pg-boss returns `null`, report that no job was inserted, likely due to singleton or deduplication constraints.

## Enqueue copy / clone semantics

Endpoint:

```http
POST /api/jobs/:id/clone
```

Semantics:

- Read the source job.
- Send a new job with source queue and source `data`.
- Source job is unchanged.
- New job gets a new pg-boss ID.
- Copy `priority` if present.
- Start immediately by default.

Do not copy:

- source job ID;
- state;
- retry count;
- timestamps;
- output;
- raw row;
- completed or failed metadata.

Avoid calling this an exact replay. The UI should use **Enqueue copy**. Existing **Retry** remains the same-row pg-boss retry for failed jobs.

## UI guidance

Manual enqueue copy:

> This enqueues a new pg-boss job and may trigger real workers.

Failed-job clean:

> This permanently deletes failed job rows from Postgres. Deleted jobs disappear from Dead Letter, metrics, timeline, and cannot be retried. This does not affect active, queued, or retrying jobs.

UI controls should be hidden or disabled unless `hasBoss`, not read-only, and the relevant capability flag is enabled. Server-side guards remain authoritative.

## Non-goals

- Direct SQL insertion into pg-boss job tables.
- Cleaning active, created, retry, or cancelled jobs.
- Cleaning all terminal jobs with one action.
- Auto-clean schedules.
- Queue pause/resume/promote parity.
- Queue creation from manual enqueue.
- MCP mutation tools.
- Per-user roles or authorization beyond existing dashboard auth/read-only settings.
- Exact clone of every historical pg-boss send option.
- Restoring deleted jobs.

## Open decisions before implementation

1. Whether direct SQL mutation is acceptable for queue clean. If not, #59 remains design-only.
2. How to resolve queue-specific pg-boss tables safely for clean operations.
3. Whether capability flags should be documented in all adapters and standalone app immediately.
4. Whether an admin audit log is required before shipping queue clean.

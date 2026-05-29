# Queue clean preview and docs polish design

Date: 2026-05-29

Issues: [#59](https://github.com/nip10/bossbench/issues/59), [#68](https://github.com/nip10/bossbench/issues/68)

## Context

Bossbench now supports safe manual enqueue and enqueue-copy actions. Queue clean remains the only non-desktop Workbench runtime parity gap. Direct deletion is intentionally deferred because pg-boss table resolution, direct SQL policy, and audit logging still need a stricter decision. The approved next step is **preview only**: show what would be eligible for cleanup without deleting anything.

Upstream Workbench 0.7.1 also improved package/site discoverability and command-copy layout. Bossbench should apply the same idea with pg-boss-native wording rather than BullMQ/bull-board positioning.

## Goals

- Add queue-clean preview capability behind `allowQueueClean` without destructive deletion.
- Keep queue-clean preview server-side gated by `readonly === false`, `PgBoss` presence, and `allowQueueClean`.
- Show eligible completed/failed job counts and sample IDs using safe read queries only.
- Improve package metadata/README discoverability for pg-boss dashboard searches.
- Improve marketing `CopyCommand` overflow behavior for long commands.

## Queue clean preview design

Add an API route:

```http
POST /api/queues/:name/clean-preview
```

Request:

```ts
type QueueCleanPreviewRequest = {
  state: "completed" | "failed";
  olderThanSeconds: number;
  limit?: number;
};
```

Response:

```ts
type QueueCleanPreviewResult = {
  queue: string;
  state: "completed" | "failed";
  cutoff: string;
  matched: number;
  sampleIds: string[];
  hasMore: boolean;
};
```

Validation and safety rules:

- `allowQueueClean` must be enabled.
- Existing mutation guards still apply: not read-only and `PgBoss` instance attached.
- Only `completed` and `failed` states are accepted.
- `olderThanSeconds` is required and must be at least `3600`.
- `limit` defaults to `1000` and is capped at `5000`.
- Match on `completed_on`, never rows with `completed_on IS NULL`.
- Preview uses `SELECT` only. No direct SQL delete and no pg-boss delete API in this wave.

UI:

- Add a compact Queue page panel when `allowQueueClean` is enabled.
- Let operators choose state, age, and limit.
- Button label: **Preview clean**.
- Result should show matched count, cutoff, sample IDs, and “has more” if the count exceeds sample/limit.
- Copy should be explicit: this is preview-only and deletes nothing.

## Docs/discoverability design

Add Bossbench-specific package metadata and documentation improvements:

- Package keywords for pg-boss dashboard/search intent.
- Homepage and repository metadata consistency where missing.
- Expand `packages/core/README.md` with adapter matrix, CLI setup, fetch-handler/core API notes, and options table.
- Update root README with current adapter list and package list if stale.
- Add scroll/overflow polish to marketing `CopyCommand` for long commands.

Avoid misleading BullMQ/bull-board claims. “Alternative” wording can be used only in comparison-oriented docs if it remains accurate: Bossbench is a pg-boss dashboard, not a BullMQ UI.

## Non-goals

- No queue clean delete action.
- No direct SQL mutation.
- No MCP mutation tools.
- No scheduled cleanup.
- No per-user role/permission model.
- No new runtime dashboard features beyond preview and docs polish.

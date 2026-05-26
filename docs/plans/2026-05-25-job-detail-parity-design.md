# Job detail parity design

Date: 2026-05-25

## Goal

Upgrade Bossbench job detail from a stacked inspection page into a Workbench-quality, pg-boss-native debugging surface. This wave closes the safe portion of issue #20: richer job detail tabs and copy/export actions.

## Scope

Implement inspect, copy, and export only. Do not add clone/requeue in this wave.

The page should help operators quickly answer:

- Which queue and state is this job in?
- When was it created, started, and completed?
- What retry, singleton, expiration, and dead-letter metadata exists?
- What payload was sent?
- What output/result was produced?
- What raw pg-boss row did Bossbench read?
- How can I copy or export this job for debugging?

## UI design

### Header card

Replace the current first summary table with a stronger header card:

- job queue/name;
- status badge;
- job ID with copy button;
- export JSON button;
- existing pg-boss actions: retry, cancel, resume, delete;
- clear browse-only disabled copy when actions are unavailable.

Delete remains destructive and must require confirmation. Actions should be locked while one is in flight to prevent duplicate requests.

### Summary metadata

Add a compact summary grid for the most important operational fields:

- Queue;
- State;
- Created;
- Started;
- Completed;
- Priority;
- Retry count;
- Retry limit;
- Singleton key;
- Expiration seconds;
- Dead-letter indicator.

The summary should preserve pg-boss terminology and not imply BullMQ-only concepts such as flow, promote, or pause.

### Tabs

Use a lightweight local tab component instead of adding a new UI library dependency.

Tabs:

1. **Summary** — metadata grid and action state/help copy.
2. **Payload** — JSON viewer for `job.data` plus copy payload JSON.
3. **Output** — JSON viewer for `job.output` plus copy output JSON.
4. **Raw** — JSON viewer for `job.raw` plus copy raw JSON.

The tab state can live inside `JobPage`. Keep routes unchanged for this wave.

## Copy and export behavior

Add reusable helpers for deterministic JSON serialization and download payload construction.

Actions:

- Copy job ID.
- Copy payload JSON.
- Copy output JSON.
- Copy raw JSON.
- Export full job detail JSON as `bossbench-job-<id>.json`.

Clipboard failures should show inline feedback instead of failing silently. Export should not depend on clipboard permissions.

## Data/API

No backend changes are expected. Use the current `JobDetail` fields:

- `id`
- `name`
- `queue`
- `state`
- `createdOn`
- `startedOn`
- `completedOn`
- `priority`
- `data`
- `output`
- `retryCount`
- `retryLimit`
- `singletonKey`
- `expireInSeconds`
- `deadLetter`
- `raw`

If implementation discovers a field already present in `raw` that deserves first-class display, add it only if it is pg-boss-native and testable.

## Error handling

- Job loading and not-found states stay unchanged.
- Clipboard copy errors show a compact banner/status message.
- Mutation action errors use the existing API error messages.
- Delete asks for confirmation before calling the API.
- Browse-only/read-only mode disables mutation buttons with explanatory copy.

## Testing

Add focused tests for pure helpers where possible:

- JSON stringification for export/copy;
- export filename construction;
- full export payload construction.

Run:

- `bun run --filter=@bossbench/core test`
- `bun run --filter=@bossbench/core typecheck`
- `bun run --filter=@bossbench/core lint`
- full workspace verification before merging.

## Non-goals

- Clone/requeue from payload.
- Editing job payloads, outputs, state, or retry metadata.
- Flow/DAG display.
- Queue pause/resume/promote equivalents.
- Backend schema changes unless a first-class pg-boss field is already available and clearly useful.

## Success criteria

- Job detail uses a clear header, metadata summary, and tabs.
- Operators can copy job ID, payload, output, and raw JSON.
- Operators can export full job detail JSON.
- Existing retry/cancel/resume/delete actions remain available and safer against duplicate clicks.
- The page feels closer to Workbench while staying pg-boss-native.

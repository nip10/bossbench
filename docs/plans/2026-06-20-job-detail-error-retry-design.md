# Job detail error and retry context design

Date: 2026-06-20

Related tracker: `docs/workbench-parity-tracker.md` job detail gap and remaining priority order.

## Context

Bossbench has already adapted most non-desktop Workbench capabilities to pg-boss. The main remaining non-desktop parity gap is richer job detail, especially error and retry context. Workbench can expose BullMQ-specific logs and per-job details that do not map directly to pg-boss. Bossbench should therefore improve debugging context from reliable pg-boss data without inventing unavailable per-attempt history.

The current job detail page already has a header, mutation actions, copy/export behavior, and Summary, Payload, Output, Timeline, and Raw tabs. The timeline helper derives basic lifecycle events from `createdOn`, `startAfter`, `startedOn`, `completedOn`, `retryCount`, and `deadLetter`.

## Goal

Make the job detail page better for failed, retried, and dead-lettered jobs by surfacing concise pg-boss-native context in the Summary and Timeline tabs.

Operators should be able to answer:

- Did the job fail, retry, or dead-letter?
- What failure text is safely available?
- How many retries have been recorded and how does that compare with the retry limit?
- Is more detail available in `output`, `deadLetter`, or the raw row?
- What should an operator inspect next?

## Non-goals

- Do not add a BullMQ-style logs tab.
- Do not imply pg-boss stores per-attempt logs or complete retry history if only aggregate retry fields are available.
- Do not add schema changes or Bossbench-owned persistence.
- Do not change mutation behavior for retry, cancel, resume, delete, or enqueue copy.
- Do not make backend queries heavier unless implementation finds a clearly safe pg-boss-native field already available in the existing row.

## Approach

Use the existing `JobDetail` payload and add pure UI helper logic in `packages/core/src/ui/lib/job-detail.ts`.

The helper layer should derive:

- failure summary text from `failureSnippet`, failed state, `output`, and `deadLetter` presence;
- retry status from `retryCount` and `retryLimit`;
- dead-letter status from `deadLetter`;
- timeline context events that distinguish timestamped lifecycle events from untimestamped operational context;
- short operator guidance that points to Output, Raw, or dead-letter metadata when useful.

Keep the API and repository shape unchanged unless a small first-class field is already present in the existing pg-boss job row and is safe to expose.

## UI design

### Summary tab

Add a compact failure/retry context section below the existing metadata grid when the job has relevant context.

Suggested cards:

- **Failure** — shows the safe failure snippet when present, otherwise states that no concise failure output is available.
- **Retries** — shows `retryCount` and `retryLimit`, with wording for unlimited/unknown limits.
- **Dead letter** — states whether dead-letter metadata is present and points users to Raw for full detail.
- **Next checks** — short bullets such as inspect Output JSON, compare retry policy, or confirm downstream service health.

Hide this section for ordinary successful jobs unless retry context exists.

### Timeline tab

Preserve current timestamped lifecycle events. Expand context cards so failed/retried/dead-lettered jobs have clearer explanations, for example:

- retry count recorded;
- retry limit reached or still available when known;
- dead-letter metadata present;
- failure output available in Output tab.

Avoid timestamps for derived context if pg-boss does not provide a precise event timestamp.

### Output and Raw tabs

Keep these tabs as the source of truth for structured diagnostic data. The new Summary/Timeline copy should link conceptually to these tabs but should not duplicate large JSON blobs.

## Data flow

1. `JobPage` loads `JobDetail` through the existing `useJob` hook.
2. Helper functions derive failure, retry, and dead-letter context from the in-memory `JobDetail` object.
3. Summary renders compact cards when derived context exists.
4. Timeline renders timestamped lifecycle events plus untimestamped context cards.
5. Output and Raw remain unchanged and provide complete structured data.

## Error handling and safety

- If failure data is unavailable, say so plainly instead of guessing.
- If retry limit is `null`, label it as unknown/unset rather than unlimited unless pg-boss semantics are certain.
- Derived helpers must tolerate unknown `output`, `deadLetter`, and `raw` shapes.
- Existing loading, not-found, read-only, clipboard, export, and mutation error handling remains unchanged.

## Testing

Add focused unit tests for pure helper behavior:

- no context for successful jobs without retries;
- failure snippet extraction and fallback copy;
- retry count/limit copy for zero, bounded, and unknown limits;
- dead-letter context when metadata is present;
- timeline context events for failed/retried/dead-lettered jobs.

Run targeted checks:

- `bun run --filter=@bossbench/core test`
- `bun run --filter=@bossbench/core typecheck`
- `bun run --filter=@bossbench/core lint`

Before merging, run broader workspace checks if the implementation touches shared UI or types.

## Success criteria

- Failed jobs surface concise, useful failure context on the Summary tab.
- Retried jobs clearly show retry count and retry limit context.
- Dead-lettered jobs clearly indicate metadata presence without overclaiming history.
- Timeline gives richer operational context while staying pg-boss-native.
- Existing job actions, copy/export behavior, and tabs continue to work.

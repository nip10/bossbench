# Queue Clean Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add explicitly-gated destructive queue clean for completed/failed pg-boss jobs, with confirmation, audit events, atomic SQL, UI controls, and docs.

**Architecture:** Keep existing `allowQueueClean` preview-only behavior. Add a new `allowQueueCleanDelete` flag and separate `/api/queues/:name/clean` endpoint that validates cutoff/confirmation before calling one atomic parameterized SQL delete against the quoted pg-boss `job` parent table. UI deletion is only exposed after a matching preview and server-side guards remain authoritative.

**Tech Stack:** TypeScript, pg-boss, Postgres, React, TanStack Router/Query, Vitest, Bun, Biome.

**Design:** `docs/plans/2026-06-04-queue-clean-delete-design.md`

**Issue:** #59

---

### Task 1: Add destructive clean options and audit types

**Files:**
- Modify: `packages/core/src/core/types.ts`
- Modify: `packages/core/src/core/options.ts`
- Modify: `packages/core/src/core/options.test.ts`
- Modify: `packages/core/src/core/core.ts`
- Modify: `packages/core/src/core/core.test.ts`

**Step 1: Write failing option/core tests**

Add tests to `packages/core/src/core/options.test.ts`:

```ts
it("defaults destructive queue clean to disabled", () => {
  const options = normalizeOptions({
    db: "postgres://example",
    allowUnauthenticated: true,
  });

  expect(options.allowQueueClean).toBe(false);
  expect(options.allowQueueCleanDelete).toBe(false);
});

it("normalizes destructive queue clean and audit options", () => {
  const onAuditEvent = vi.fn();
  const options = normalizeOptions({
    db: "postgres://example",
    allowUnauthenticated: true,
    allowQueueClean: true,
    allowQueueCleanDelete: true,
    onAuditEvent,
  });

  expect(options.allowQueueCleanDelete).toBe(true);
  expect(options.onAuditEvent).toBe(onAuditEvent);
});
```

Add `vi` to the imports if needed.

Add to `packages/core/src/core/core.test.ts`:

```ts
expect(core.getConfig().allowQueueCleanDelete).toBe(false);
```

**Step 2: Run tests to verify failure**

Run:

```bash
bun test packages/core/src/core/options.test.ts packages/core/src/core/core.test.ts
```

Expected: FAIL because `allowQueueCleanDelete` and `onAuditEvent` do not exist.

**Step 3: Add public types**

In `packages/core/src/core/types.ts`, add:

```ts
export interface BossbenchAuditEvent {
  type: "queue.clean.delete";
  at: string;
  queue: string;
  state: Extract<BossbenchJobState, "completed" | "failed">;
  cutoff: string;
  limit: number;
  deleted: number;
  deletedIds: string[];
  hasMore: boolean;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
}
```

Extend `BossbenchOptions`:

```ts
allowQueueCleanDelete?: boolean;
onAuditEvent?: (event: BossbenchAuditEvent) => void | Promise<void>;
```

Extend `NormalizedBossbenchOptions`:

```ts
allowQueueCleanDelete: boolean;
```

**Step 4: Normalize options**

In `packages/core/src/core/options.ts`, add to the returned options:

```ts
allowQueueCleanDelete: options.allowQueueCleanDelete ?? false,
```

`onAuditEvent` can flow through via `...rest`.

**Step 5: Expose safe config**

In `packages/core/src/core/core.ts`, add to `getConfig()`:

```ts
allowQueueCleanDelete: this.options.allowQueueCleanDelete,
```

Do not expose `onAuditEvent`.

**Step 6: Run verification**

Run:

```bash
bun test packages/core/src/core/options.test.ts packages/core/src/core/core.test.ts
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add packages/core/src/core/types.ts packages/core/src/core/options.ts packages/core/src/core/options.test.ts packages/core/src/core/core.ts packages/core/src/core/core.test.ts
git commit -m "feat: add queue clean delete options"
```

---

### Task 2: Add destructive clean guards and request validation

**Files:**
- Modify: `packages/core/src/core/actions.ts`
- Modify: `packages/core/src/core/actions.test.ts`
- Modify: `packages/core/src/core/types.ts`
- Modify: `packages/core/src/api/handlers.ts`
- Modify: `packages/core/src/api/handlers.test.ts`

**Step 1: Write failing action guard tests**

In `packages/core/src/core/actions.test.ts`, add tests mirroring existing queue-clean preview guard tests:

```ts
it("blocks queue clean delete when readonly", () => {
  const actions = new PgBossActionService(undefined, true, {
    allowQueueClean: true,
    allowQueueCleanDelete: true,
  });

  expect(() => actions.ensureQueueCleanDeleteAvailable()).toThrow("Read-only mode enabled");
});

it("blocks queue clean delete when boss is missing", () => {
  const actions = new PgBossActionService(undefined, false, {
    allowQueueClean: true,
    allowQueueCleanDelete: true,
  });

  expect(() => actions.ensureQueueCleanDeleteAvailable()).toThrow("pg-boss instance required for mutations");
});

it("blocks queue clean delete when preview flag is disabled", () => {
  const actions = new PgBossActionService({} as never, false, {
    allowQueueClean: false,
    allowQueueCleanDelete: true,
  });

  expect(() => actions.ensureQueueCleanDeleteAvailable()).toThrow("Queue clean preview is disabled");
});

it("blocks queue clean delete when destructive flag is disabled", () => {
  const actions = new PgBossActionService({} as never, false, {
    allowQueueClean: true,
    allowQueueCleanDelete: false,
  });

  expect(() => actions.ensureQueueCleanDeleteAvailable()).toThrow("Queue clean delete is disabled");
});
```

**Step 2: Run action tests to verify failure**

Run:

```bash
bun test packages/core/src/core/actions.test.ts
```

Expected: FAIL because `allowQueueCleanDelete` and `ensureQueueCleanDeleteAvailable()` do not exist.

**Step 3: Implement action guard**

In `packages/core/src/core/actions.ts`, extend `ActionCapabilities`:

```ts
allowQueueCleanDelete?: boolean;
```

Add:

```ts
ensureQueueCleanDeleteAvailable() {
  this.ensureQueueCleanAvailable();
  if (!this.capabilities.allowQueueCleanDelete)
    throw actionError("QUEUE_CLEAN_DELETE_DISABLED", "Queue clean delete is disabled");
}
```

In `BossbenchCore.create()`, pass the new capability into `PgBossActionService`.

**Step 4: Add request/response types**

In `packages/core/src/core/types.ts`, add:

```ts
export interface QueueCleanDeleteRequest {
  state: Extract<BossbenchJobState, "completed" | "failed">;
  cutoff: string;
  limit?: number;
  confirm: string;
}

export interface QueueCleanDeleteResult {
  queue: string;
  state: Extract<BossbenchJobState, "completed" | "failed">;
  cutoff: string;
  deleted: number;
  deletedIds: string[];
  hasMore: boolean;
}
```

**Step 5: Write failing API validation tests**

In `packages/core/src/api/handlers.test.ts`, add tests for `POST /queues/:name/clean`:

```ts
it("validates queue clean delete requests", async () => {
  const cleanQueue = vi.fn();
  const route = buildRouteTable(fakeCore(vi.fn(), { cleanQueue }) as never).find(
    (candidate) => candidate.method === "post" && candidate.path === "/queues/:name/clean",
  );

  expect(route).toBeDefined();
  assertRoute(route);

  await expect(
    route.handler({
      params: { name: "email" },
      query: {},
      body: { state: "created", cutoff: "2026-06-04T10:00:00.000Z", confirm: "clean created email" },
    }),
  ).resolves.toMatchObject({ status: 400, body: { error: { code: "INVALID_FILTER" } } });

  expect(cleanQueue).not.toHaveBeenCalled();
});
```

Add a success-path test that calls `repository.cleanQueue()` with validated body after `actions.ensureQueueCleanDeleteAvailable()`.

**Step 6: Implement API route and validation**

In `packages/core/src/api/handlers.ts`, add route:

```ts
{
  method: "post",
  path: "/queues/:name/clean",
  handler: async ({ params, body }) =>
    mutate(async () => {
      const name = required(params.name, "QUEUE_NOT_FOUND", "Queue not found");
      const request = validateQueueCleanDeleteBody(body, name);
      actions.ensureQueueCleanDeleteAvailable();
      return repository.cleanQueue(name, request);
    }),
},
```

Validation rules:

- body must be an object;
- state must be `completed` or `failed`;
- cutoff must be a valid date string;
- cutoff must be at least `3600` seconds old;
- limit defaults later in repository, but if present must be positive and at most `5000`;
- confirm must equal `clean ${state} ${queue}`.

Use `INVALID_FILTER` for bad request bodies.

**Step 7: Run verification**

Run:

```bash
bun test packages/core/src/core/actions.test.ts packages/core/src/core/core.test.ts packages/core/src/api/handlers.test.ts
bun run --filter=@bossbench/core typecheck
```

Expected: PASS.

**Step 8: Commit**

```bash
git add packages/core/src/core/actions.ts packages/core/src/core/actions.test.ts packages/core/src/core/core.ts packages/core/src/core/types.ts packages/core/src/api/handlers.ts packages/core/src/api/handlers.test.ts
git commit -m "feat: add queue clean delete guards"
```

---

### Task 3: Implement atomic repository delete and audit event

**Files:**
- Modify: `packages/core/src/core/repository.ts`
- Modify: `packages/core/src/core/repository.test.ts`
- Modify: `packages/core/src/core/core.ts`
- Modify: `packages/core/src/core/core.test.ts`
- Modify: `packages/core/src/api/handlers.ts`
- Modify: `packages/core/src/api/handlers.test.ts`

**Step 1: Write failing repository SQL test**

In `packages/core/src/core/repository.test.ts`, add:

```ts
describe("BossbenchRepository.cleanQueue", () => {
  it("builds an atomic delete query for completed and failed jobs", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ deleted: 2, deletedIds: ["job-1", "job-2"], hasMore: true }],
    });
    const repository = new BossbenchRepository({ query } as never, "bossbench", []);

    const result = await repository.cleanQueue("email", {
      state: "failed",
      cutoff: "2026-06-04T10:00:00.000Z",
      limit: 25,
      confirm: "clean failed email",
    });

    expect(query.mock.calls[0]?.[0]).toContain("for update of j skip locked");
    expect(query.mock.calls[0]?.[0]).toContain("delete from");
    expect(query.mock.calls[0]?.[0]).toContain("completed_on is not null");
    expect(query.mock.calls[0]?.[1]).toEqual(["email", "failed", "2026-06-04T10:00:00.000Z", 25]);
    expect(result).toEqual({
      queue: "email",
      state: "failed",
      cutoff: "2026-06-04T10:00:00.000Z",
      deleted: 2,
      deletedIds: ["job-1", "job-2"],
      hasMore: true,
    });
  });
});
```

**Step 2: Run repository test to verify failure**

Run:

```bash
bun test packages/core/src/core/repository.test.ts -t "cleanQueue"
```

Expected: FAIL because `cleanQueue()` does not exist.

**Step 3: Implement repository delete**

In `packages/core/src/core/repository.ts`, add `cleanQueue(queue, request)` using the SQL from the design. Use existing `this.q("job")`, `clamp()`, `numberOrDefault()`, and string mapping helpers.

The method must return `QueueCleanDeleteResult` and must not run multiple statements.

**Step 4: Add audit orchestration tests**

In `packages/core/src/core/core.test.ts`, add a test for a `core.cleanQueue()` method:

```ts
it("emits audit events for successful queue clean deletes", async () => {
  const onAuditEvent = vi.fn();
  const core = BossbenchCore.create({
    db: "postgres://example",
    allowUnauthenticated: true,
    allowQueueClean: true,
    allowQueueCleanDelete: true,
    onAuditEvent,
    boss: {} as never,
  });
  core.repository.cleanQueue = vi.fn(async () => ({
    queue: "email",
    state: "failed",
    cutoff: "2026-06-04T10:00:00.000Z",
    deleted: 2,
    deletedIds: ["job-1", "job-2"],
    hasMore: false,
  }));

  await core.cleanQueue("email", {
    state: "failed",
    cutoff: "2026-06-04T10:00:00.000Z",
    limit: 25,
    confirm: "clean failed email",
  });

  expect(onAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
    type: "queue.clean.delete",
    ok: true,
    queue: "email",
    deleted: 2,
  }));
});
```

**Step 5: Implement core audit wrapper**

In `packages/core/src/core/core.ts`, add:

```ts
async cleanQueue(queue: string, request: QueueCleanDeleteRequest) {
  const limit = request.limit ?? 1000;
  const result = await this.repository.cleanQueue(queue, request);
  await this.options.onAuditEvent?.({
    type: "queue.clean.delete",
    at: new Date().toISOString(),
    queue,
    state: request.state,
    cutoff: request.cutoff,
    limit,
    deleted: result.deleted,
    deletedIds: result.deletedIds,
    hasMore: result.hasMore,
    ok: true,
  });
  return result;
}
```

If audit hook failure semantics become awkward, keep the hook after successful delete and allow it to throw; document/fix in review if necessary.

**Step 6: Route through core wrapper**

Change `/queues/:name/clean` handler to call `core.cleanQueue(name, request)` instead of `repository.cleanQueue()`.

**Step 7: Run verification**

Run:

```bash
bun test packages/core/src/core/repository.test.ts -t "cleanQueue"
bun test packages/core/src/core/core.test.ts packages/core/src/api/handlers.test.ts
bun run --filter=@bossbench/core typecheck
bun run --filter=@bossbench/core lint
```

Expected: PASS.

**Step 8: Commit**

```bash
git add packages/core/src/core/repository.ts packages/core/src/core/repository.test.ts packages/core/src/core/core.ts packages/core/src/core/core.test.ts packages/core/src/api/handlers.ts packages/core/src/api/handlers.test.ts
git commit -m "feat: delete queue clean matches"
```

---

### Task 4: Add client API and Queue page delete UI

**Files:**
- Modify: `packages/core/src/ui/lib/api.ts`
- Modify: `packages/core/src/ui/lib/api.test.ts`
- Modify: `packages/core/src/ui/pages.tsx`
- Modify: `packages/core/src/core/types.ts` if UI needs exported config shape

**Step 1: Write failing API client test**

In `packages/core/src/ui/lib/api.test.ts`, add:

```ts
it("posts queue clean delete requests", async () => {
  const response = {
    ok: true,
    result: {
      queue: "email",
      state: "failed",
      cutoff: "2026-06-04T10:00:00.000Z",
      deleted: 2,
      deletedIds: ["job-1", "job-2"],
      hasMore: false,
    },
  };
  const fetchMock = mockFetchJson(response);

  await expect(
    api.cleanQueue("email", {
      state: "failed",
      cutoff: "2026-06-04T10:00:00.000Z",
      limit: 25,
      confirm: "clean failed email",
    }),
  ).resolves.toEqual(response);

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/queues/email/clean"),
    expect.objectContaining({ method: "POST" }),
  );
});
```

**Step 2: Run API client test to verify failure**

Run:

```bash
bun test packages/core/src/ui/lib/api.test.ts
```

Expected: FAIL because `api.cleanQueue()` does not exist.

**Step 3: Implement API client**

In `packages/core/src/ui/lib/api.ts`, import `QueueCleanDeleteRequest` and `QueueCleanDeleteResult`, then add:

```ts
cleanQueue: (queue: string, request: QueueCleanDeleteRequest) =>
  fetchJson<MutationResponse<QueueCleanDeleteResult>>(
    `/queues/${encodeURIComponent(queue)}/clean`,
    { method: "POST", body: JSON.stringify(request) },
  ),
```

Also add `allowQueueCleanDelete?: boolean` to config response type.

**Step 4: Add UI state and controls**

In `packages/core/src/ui/pages.tsx`, extend `QueuePage`:

- read `config?.allowQueueCleanDelete`;
- add state for `deleteConfirmInput`, `deleteFeedback`, `deleteInFlight`, and optional `deleteResult`;
- after successful preview, render destructive delete controls only when `allowQueueCleanDelete` is true;
- expected confirmation: `clean ${previewState.result.state} ${previewState.result.queue}`;
- disable delete unless confirmation matches and not in flight;
- disable preview inputs while delete is in flight;
- call `api.cleanQueue(queueName, { state, cutoff, limit, confirm })`;
- invalidate queue/overview/jobs/dead-letter/metrics queries after success;
- show deleted count, deleted IDs, and `hasMore`.

Use existing `Section`, `Button`, `Input`, `banner compact`, and `stack` patterns. Keep copy irreversible and explicit.

**Step 5: Run verification**

Run:

```bash
bun test packages/core/src/ui/lib/api.test.ts
bun run --filter=@bossbench/core typecheck
bun run --filter=@bossbench/core lint
```

Expected: PASS.

**Step 6: Request UI review**

Use @designer to review the queue delete UI for clarity, irreversible warning copy, disabled states, and stale preview behavior. Fix Critical/Important findings.

**Step 7: Commit**

```bash
git add packages/core/src/ui/lib/api.ts packages/core/src/ui/lib/api.test.ts packages/core/src/ui/pages.tsx
git commit -m "feat: add queue clean delete UI"
```

---

### Task 5: Add docs and integration coverage

**Files:**
- Modify: `README.md`
- Modify: `packages/core/README.md`
- Modify: `docs/workbench-parity-tracker.md`
- Modify or create integration tests under `packages/core/src/core/*integration*.test.ts` based on existing integration patterns

**Step 1: Update docs**

Update docs to state:

- `allowQueueClean` is preview only;
- `allowQueueCleanDelete` enables destructive delete;
- failed deletion removes Dead Letter/retry evidence;
- direct SQL targets pg-boss storage;
- clean is batch-limited and should be repeated while `hasMore` is true;
- exact confirmation is required.

**Step 2: Update parity tracker**

Change queue clean status from adapted preview-only to implemented/adapted with destructive delete if this PR completes it. Remove or update #59 priority text as appropriate.

**Step 3: Add integration tests if practical**

Inspect current integration test setup. Add tests for:

- completed-only deletion;
- failed-only deletion;
- no deletion of created/retry/active/cancelled;
- cutoff and limit behavior;
- confirmation failure.

If integration setup is too expensive for this pass, add repository-level SQL tests and document the integration gap in the PR body.

**Step 4: Run verification**

Run:

```bash
bun test packages/core/src/core/options.test.ts packages/core/src/core/actions.test.ts packages/core/src/core/repository.test.ts packages/core/src/core/core.test.ts packages/core/src/api/handlers.test.ts packages/core/src/ui/lib/api.test.ts
bun run --filter=@bossbench/core typecheck
bun run --filter=@bossbench/core lint
```

If integration tests were added and a local database is available, also run:

```bash
bun run --filter=@bossbench/core test:integration
```

**Step 5: Request final review**

Use @oracle for final safety review. Ask specifically about:

- direct SQL correctness;
- destructive flag safety;
- validation and confirmation;
- audit event semantics;
- UI stale preview behavior;
- docs accuracy.

Fix Critical/Important findings.

**Step 6: Commit**

```bash
git add README.md packages/core/README.md docs/workbench-parity-tracker.md packages/core/src/core
git commit -m "docs: document queue clean delete"
```

---

### Task 6: Final branch verification and PR

**Files:**
- All changed files

**Step 1: Inspect status and diff**

Run:

```bash
git status --short
git diff --check
git log --oneline -10
```

Expected: clean working tree after commits and no whitespace errors.

**Step 2: Run focused checks**

Run:

```bash
bun test packages/core/src/core/options.test.ts packages/core/src/core/actions.test.ts packages/core/src/core/repository.test.ts packages/core/src/core/core.test.ts packages/core/src/api/handlers.test.ts packages/core/src/ui/lib/api.test.ts
bun run --filter=@bossbench/core typecheck
bun run --filter=@bossbench/core lint
```

Expected: PASS.

**Step 3: Push and create PR**

Only after all checks pass:

```bash
git push -u origin feature/queue-clean-delete
gh pr create --repo nip10/bossbench --base main --head feature/queue-clean-delete --title "feat: add queue clean delete" --body-file -
```

PR body should include:

- summary of new destructive flag and endpoint;
- direct SQL safety notes;
- audit event behavior;
- test plan;
- issue close: `Closes #59`.

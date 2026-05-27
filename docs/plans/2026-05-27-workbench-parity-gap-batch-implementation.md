# Workbench Parity Gap Batch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create GitHub tracking issues for the newly audited Workbench parity gaps and implement the first independent parity wave with parallel subagents.

**Architecture:** Treat Workbench parity as pg-boss-native adaptation, not direct BullMQ copying. Create all tracking issues first, then run independent workstreams for standalone deployment, failed reason snippets, h3 adapter support, and dashboard command-center polish. The orchestrator integrates results, updates docs, and runs verification.

**Tech Stack:** Bun workspaces, TypeScript, React, Hono, pg-boss, pg, Turbo, Vitest, GitHub CLI, Docker.

---

## Rules for this plan

- Do not work on desktop; existing issues #14 and #29-#34 cover it.
- Keep `docs/workbench-parity-tracker.md` as the source of truth for parity status.
- Use parallel subagents only for independent paths.
- Do not commit unless the user explicitly requests a commit, even though checkpoints are listed.
- Run verification before claiming completion.

## Task 1: Create GitHub tracking issues

**Files:**
- Read: `docs/workbench-parity-tracker.md`
- Read: `docs/plans/2026-05-27-workbench-parity-gap-batch-design.md`
- Modify after issue creation: `docs/workbench-parity-tracker.md`

**Step 1: Confirm no duplicates**

Run:

```bash
gh issue list --state all --limit 100 --json number,title,state,labels,url
```

Expected: desktop issues exist; new non-desktop parity gaps are not already open.

**Step 2: Create issues**

Create one issue for each approved gap:

1. `[Parity] Add standalone Docker deployment`
2. `[Parity] Show failed reason snippets in job lists`
3. `[Parity] Improve dashboard command-center polish`
4. `[Parity] Design pg-boss-safe queue clean semantics`
5. `[Parity] Design manual enqueue/requeue flow`
6. `[Adapter] Add h3 adapter`
7. `[Adapter] Add Nuxt/Nitro integration`
8. `[Adapter] Evaluate/Add AdonisJS adapter`
9. `[Adapter] Evaluate/Add TanStack Start adapter`

Each body should include:

```markdown
## Context

Tracked from the 2026-05-27 Workbench parity audit against `pontusab/workbench@e4bab1d`.

## Scope

- [gap-specific bullet]

## Acceptance criteria

- [testable acceptance criterion]

## Notes

See `docs/workbench-parity-tracker.md` and `docs/plans/2026-05-27-workbench-parity-gap-batch-design.md`.
```

**Step 3: Update tracker issue links**

Replace `—` or generic issue references for the newly created rows where practical:

- failed reason snippets
- queue clean
- manual enqueue/requeue
- h3/Nuxt
- AdonisJS/TanStack Start
- standalone Docker deployment
- dashboard command-center polish if a matching row exists

**Step 4: Verify issue creation and tracker diff**

Run:

```bash
gh issue list --state open --limit 50 --json number,title,url
git diff -- docs/workbench-parity-tracker.md
git diff --check -- docs/workbench-parity-tracker.md
```

Expected: the nine new issues exist, tracker links point to them, and diff check has no output.

## Task 2: Parallel first-wave dispatch

**Files:**
- Read: `docs/plans/2026-05-27-workbench-parity-gap-batch-design.md`
- Read: `docs/workbench-parity-tracker.md`

**Step 1: Dispatch independent subagents**

Launch four subagents in parallel:

### Subagent A: Standalone Docker app

Prompt summary:

```markdown
Implement a minimal standalone Bossbench app for external pg-boss/Postgres connections.

Scope:
- Inspect `packages/core`, adapter APIs, examples, and root workspace config.
- Add `apps/standalone` if this is the right shape.
- Provide env-based config for DATABASE_URL, schema, base path, auth, readonly, host, and port.
- Default to read-only unless auth+writable config explicitly enables mutations.
- Add Dockerfile and docs.
- Add package scripts and smoke coverage if feasible.

Do not edit adapter packages unrelated to standalone. Return changed files, behavior, tests run, and blockers.
```

### Subagent B: Failed reason snippets

Prompt summary:

```markdown
Add pg-boss-native failed reason snippets to job list summaries.

Scope:
- Add a short failure/output snippet to `JobSummary` only when useful and safe.
- Populate it in repository job summary mapping from pg-boss output/error fields.
- Render it in Jobs rows and queue recent jobs for failed jobs without making tables unreadable.
- Add repository/API/UI tests.

Do not implement manual enqueue or queue clean. Return changed files, tests run, and blockers.
```

### Subagent C: h3 adapter

Prompt summary:

```markdown
Add first-party `@bossbench/h3` adapter.

Scope:
- Inspect existing adapter package patterns.
- Create `packages/h3` with package.json, tsup config, src, tests, README.
- Add `examples/with-h3` if feasible.
- Add CLI detection/injection only if it can be done cleanly in this pass.
- Add smoke script coverage if feasible.

Do not implement Nuxt yet. Return changed files, tests run, and blockers.
```

### Subagent D: Dashboard command-center polish

Prompt summary:

```markdown
Improve Bossbench dashboard command-center polish incrementally.

Scope:
- Enhance Overview attention signals using data already available from overview/metrics.
- Add live/refresh timestamp cue in the shell/header if low-risk.
- Evaluate collapsible sidebar; implement only if isolated and not a broad rewrite.
- Preserve current CSS/React structure.
- Add UI tests or unit tests for helper logic where feasible.

Avoid conflicting with failed-reason snippet work on job tables. Return changed files, tests run, and blockers.
```

**Step 2: Wait for subagent results**

Expected: each subagent returns a concise summary with changed files, validation, and unresolved issues.

## Task 3: Integrate first-wave results

**Files:**
- Modify as returned by subagents.
- Modify: `docs/workbench-parity-tracker.md`
- Modify: root `README.md` if standalone or h3 user-facing docs land.

**Step 1: Inspect workspace changes**

Run:

```bash
git status --short
git diff --stat
```

Expected: changes are limited to the approved first-wave surfaces plus docs.

**Step 2: Review for conflicts and scope creep**

Check:

- No desktop files were changed.
- Nuxt/Adonis/TanStack work did not sneak into h3 unless explicitly scoped as evaluation docs.
- Queue clean and manual enqueue remain design-only unless explicitly safe and approved.
- Failed snippets do not expose sensitive large payloads by default.
- Standalone writable mode is not enabled accidentally.

**Step 3: Update tracker statuses**

If a feature landed, update its row:

- h3 adapter: `Planned` → `Implemented` if package/docs/tests land.
- standalone Docker deployment: `Gap` → `Implemented` or `Planned` depending completeness.
- failed reason snippets: `Gap` → `Implemented` if UI/API/tests land.
- dashboard command center: keep `Adapted`, update rationale with landed improvements.

**Step 4: Checkpoint**

Do not commit unless explicitly requested. If asked to commit, inspect status/diff/log first.

## Task 4: Verification

**Files:** all changed files.

**Step 1: Run targeted tests from subagents**

Run the specific commands returned by each subagent. Expected: all pass.

**Step 2: Run broader repo checks**

Run as feasible:

```bash
bun run typecheck
bun run test
bun run smoke
git diff --check
```

Expected: commands exit 0. If Docker/Postgres is unavailable, document exactly which check was skipped or failed and why.

**Step 3: Report final status**

Report:

- GitHub issue URLs created.
- Features implemented vs deferred.
- Verification commands and results.
- Remaining blockers/follow-up issues.

## Task 5: Follow-up wave planning

Only after first-wave integration is stable, plan the next independent wave:

- Nuxt/Nitro integration after h3 lands.
- AdonisJS adapter evaluation/implementation.
- TanStack Start adapter evaluation/implementation.
- Queue clean design.
- Manual enqueue/requeue design.

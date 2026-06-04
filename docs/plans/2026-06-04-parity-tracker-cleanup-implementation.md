# Parity Tracker Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the Workbench parity tracker so it reflects merged non-desktop parity work and only lists currently open parity issues.

**Architecture:** This is a docs-only cleanup. Edit only `docs/workbench-parity-tracker.md`, preserve the historical audit log, and validate with markdown diff checks plus GitHub issue state.

**Tech Stack:** Markdown, GitHub CLI, git.

**Design:** `docs/plans/2026-06-04-parity-tracker-cleanup-design.md`

---

### Task 1: Verify current issue state

**Files:**
- Read-only: GitHub issues

**Step 1: Check open issues**

Run:

```bash
gh issue list --repo nip10/bossbench --state open --limit 100 --json number,title,labels
```

Expected: only desktop issues #14 and #29-#34 are open.

**Step 2: Check recently closed parity issues**

Run each command:

```bash
gh issue view 59 --repo nip10/bossbench --json number,state,title
gh issue view 71 --repo nip10/bossbench --json number,state,title
gh issue view 72 --repo nip10/bossbench --json number,state,title
gh issue view 73 --repo nip10/bossbench --json number,state,title
gh issue view 74 --repo nip10/bossbench --json number,state,title
gh issue view 75 --repo nip10/bossbench --json number,state,title
```

Expected: #59 and #71-#75 are closed.

### Task 2: Update parity tracker current state

**Files:**
- Modify: `docs/workbench-parity-tracker.md`

**Step 1: Edit current summary**

Update `## Current summary` to say:

- non-desktop parity is strong;
- alerting/evaluation/delivery, Slack/Discord destinations, docs/marketing cleanup, MCP, adapters, standalone, manual enqueue, and queue clean delete are implemented/adapted;
- remaining major parity item is desktop, with ongoing optional polish around job detail/command center.

**Step 2: Edit open parity issues**

Remove these bullets:

- #59
- #71
- #72
- #73
- #74
- #75

Keep:

- #14
- #29
- #30
- #31
- #32
- #33
- #34

**Step 3: Edit dashboard/API/ecosystem rows**

Update rows:

- `Alerts dashboard`: change `Planned` to `Implemented` or `Adapted`; describe current Alerts page/rules/violations/contact summaries.
- `Alert evaluation and delivery`: change `Planned` to `Adapted`; describe pg-boss SQL polling/evaluation, optional runner, webhook/Slack/Discord payloads.
- `Marketing/docs site`: remove open #74/#75 wording and issue links; say completed.

Keep historical audit rows unchanged.

**Step 4: Edit remaining priority order**

Remove alerting/docs/marketing and queue-clean as active priorities. Replace with:

1. Deepen pg-boss job detail further: retry/error history and safe operational detail.
2. Continue dashboard command-center polish: richer overview/alerts/live cues and optional sidebar/command palette polish.
3. Keep desktop parity deferred through #14 and child issues #29-#34 until desktop work is explicitly resumed.

### Task 3: Verify and commit

**Files:**
- Modified: `docs/workbench-parity-tracker.md`
- Created: `docs/plans/2026-06-04-parity-tracker-cleanup-implementation.md`

**Step 1: Run diff checks**

Run:

```bash
git diff -- docs/workbench-parity-tracker.md
git diff --check -- docs/workbench-parity-tracker.md
```

Expected: only tracker state cleanup; no whitespace errors.

**Step 2: Commit**

Run:

```bash
git add docs/workbench-parity-tracker.md docs/plans/2026-06-04-parity-tracker-cleanup-implementation.md
git commit -m "docs: clean up parity tracker state"
```

### Task 4: Push and PR

**Files:**
- Branch: `docs/parity-tracker-cleanup`

**Step 1: Inspect branch**

Run:

```bash
git status --short
git log --oneline -5
git diff --stat main...HEAD
```

Expected: clean worktree, docs-only diff.

**Step 2: Push and create PR**

Run:

```bash
git push -u origin docs/parity-tracker-cleanup
```

Then create a PR titled `docs: clean up parity tracker state` with this summary:

- Removes closed non-desktop parity issues from the open tracker list.
- Marks alerting, alert delivery, docs/marketing cleanup, and queue clean delete as implemented/adapted.
- Leaves desktop as the only active parity issue group while keeping job detail and command-center polish as future themes.

Test plan:

- `git diff --check -- docs/workbench-parity-tracker.md`
- `gh issue list --repo nip10/bossbench --state open --limit 100 --json number,title,labels`

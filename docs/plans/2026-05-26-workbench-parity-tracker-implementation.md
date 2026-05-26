# Workbench Parity Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a maintained Workbench-vs-Bossbench parity tracker document and update issue #15.

**Architecture:** This is documentation-only. Create `docs/workbench-parity-tracker.md` as the source of truth and keep existing planning docs unchanged except for this implementation/design plan.

**Tech Stack:** Markdown, GitHub issues, existing repo docs.

---

## Task 1: Create tracker document

**Files:**
- Create: `docs/workbench-parity-tracker.md`

**Steps:**
1. Add intro explaining status definitions.
2. Add current summary of parity state.
3. Add grouped matrix tables for UI, backend/API, and ecosystem.
4. Link remaining work to issues #9, #11, #12, #13, #14, and #25.
5. Mark flow/DAG/promote/pause as non-goals unless a pg-boss equivalent is later designed.

## Task 2: Verify docs formatting and repo checks

**Commands:**

```bash
bun run lint
bun run --filter=@bossbench/core test
```

Expected: lint exits 0 with only existing generated-file warnings; core tests pass.

## Task 3: Commit and PR

**Steps:**
1. Commit docs.
2. Push branch `parity-tracker`.
3. Open PR with `Closes #15`.
4. Comment on #9/#11/#12/#13/#14/#25 only if new issues are discovered. Otherwise leave them open.

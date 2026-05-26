# Workbench parity tracker design

Date: 2026-05-26

## Goal

Create a maintained source of truth for Bossbench parity with upstream Workbench. The tracker should make remaining work explicit, separate intentional pg-boss-native differences from real gaps, and guide future issues/PRs.

## Approach

Use one repository document at `docs/workbench-parity-tracker.md` with a feature matrix grouped by product area:

- dashboard shell and navigation;
- overview;
- jobs and job detail;
- queues;
- schedules/repeatables;
- metrics and activity;
- flows and unsupported BullMQ-only concepts;
- backend/API;
- ecosystem, docs, release, and desktop.

Each row should include:

- Workbench capability;
- Bossbench status: `Implemented`, `Adapted`, `Planned`, `Non-goal`, or `Gap`;
- Bossbench equivalent or rationale;
- tracking issue.

## Status definitions

- **Implemented** — Bossbench has equivalent or better behavior.
- **Adapted** — Bossbench has a pg-boss-native equivalent with different terms/data model.
- **Planned** — desired but not complete; tracked by an open issue.
- **Non-goal** — intentionally not planned because the concept is BullMQ-specific or unsafe for pg-boss.
- **Gap** — real missing capability that needs issue coverage.

## Current source inputs

The initial matrix is based on:

- direct audit of `pontusab/workbench` at the latest inspected snapshot;
- Bossbench current `main` after merged Jobs and Metrics parity work;
- open issues #9, #11, #12, #13, #14, #15, and #25;
- closed Jobs/Metrics issues #16–#24 and #26.

## Success criteria

- `docs/workbench-parity-tracker.md` exists.
- Every major Workbench product surface has a row.
- Remaining planned/gap work links to existing issues.
- BullMQ-only non-goals are explicit and not hand-waved.
- Issue #15 can be closed when the tracker PR merges.

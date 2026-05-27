# Job Timeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a pg-boss-native Timeline tab to job detail.

**Architecture:** Add a tested timeline builder in `packages/core/src/ui/lib/job-detail.ts`, then render it from `JobPage` as a new tab. Avoid new backend endpoints because the data needed is already present in `JobDetail`.

**Tech Stack:** TypeScript, React, Vitest, Bun/Turbo monorepo.

---

### Task 1: Timeline builder tests

Add failing tests for timestamped lifecycle events, retry context, dead-letter context, and missing timestamp fallback.

### Task 2: Timeline builder implementation

Implement `buildJobTimeline(job)` and typed timeline events.

### Task 3: Timeline tab UI

Add Timeline to Job Detail tabs, render timestamped events separately from context facts, and add responsive styles.

### Task 4: Tracker and verification

Update parity tracker and run core tests, typecheck, lint, and diff checks.

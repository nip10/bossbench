# Dashboard UX Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve dashboard shell interactions with a richer command palette, queue shortcuts, and keyboard help.

**Architecture:** Use existing `/jobs`, `/tags/:field/values`, and queue data. Add small client API/hook helpers and enhance layout components.

**Tech Stack:** React 19, TanStack Query, TanStack Router, existing Bossbench UI components.

---

## Task 1: Client API and hooks

- Add `api.tagValues(field, limit?)`.
- Add `useTagValues(field, enabled?)`.
- Add `useJobSearch(query, enabled?)` using `api.jobs({ q: query, limit: 5 })`.

## Task 2: Command palette

- Keep navigation and queue selection.
- Filter navigation/queues by input.
- Show matching jobs for non-empty input.
- Show tag field suggestions when typing a configured tag prefix.
- Show tag values when input looks like `tagName:value` and tag is configured.

## Task 3: Sidebar and settings polish

- Show first few queue shortcuts in sidebar below nav.
- Settings page lists keyboard shortcuts: command palette, refresh, theme toggle.

## Task 4: Verification

Run:

```bash
bun run --filter=@bossbench/core lint
bun run --filter=@bossbench/core typecheck
bun run --filter=@bossbench/core test
bun run lint
bun run typecheck
bun run test
```

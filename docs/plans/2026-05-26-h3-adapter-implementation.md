# h3 Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `@bossbench/h3` as the first additional adapter if adapter expansion proceeds.

**Architecture:** Reuse `@bossbench/core`'s fetch handler and adapt h3 requests/responses at the edge. Keep the adapter thin and avoid Nuxt-specific assumptions.

**Tech Stack:** TypeScript, h3, @bossbench/core, tsup, Vitest, Bun/Turbo monorepo.

---

### Task 1: Research h3 request/response conversion

Confirm h3 helpers for reading method, URL, body, headers, and returning a Response or event handler result.

### Task 2: Package scaffold

Create `packages/h3` with package metadata, README, tsconfig, tsup config, and source entrypoint.

### Task 3: Adapter tests first

Write tests proving all HTTP methods route through the Bossbench fetch handler and preserve base path/auth behavior.

### Task 4: Implementation

Implement a thin `bossbench(options)` h3 event handler.

### Task 5: Example and smoke

Add `examples/with-h3`, update smoke package entrypoint checks, and document CLI support as deferred unless implemented.

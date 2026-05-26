# AI Discoverability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI-search-friendly metadata, crawler policy, structured data, and `llms.txt` for Bossbench.

**Architecture:** Use Next.js metadata routes for robots and sitemap, static `public/llms.txt` for agent-readable context, and root-layout JSON-LD for schema.org entity definition.

**Tech Stack:** Next.js App Router, TypeScript, schema.org JSON-LD, Bun/Turbo monorepo.

---

### Task 1: Add `llms.txt`

Create `apps/web/public/llms.txt` with Bossbench facts, supported adapters, safety model, and FAQ-style answers.

### Task 2: Add crawler and sitemap routes

Create `apps/web/src/app/robots.ts` and `apps/web/src/app/sitemap.ts` using `NEXT_PUBLIC_SITE_URL` with a `https://bossbench.dev` fallback.

### Task 3: Add metadata and JSON-LD

Update `apps/web/src/app/layout.tsx` with richer metadata and JSON-LD for `Organization`, `WebSite`, `SoftwareApplication`, and `FAQPage`.

### Task 4: Verify

Run:

- `bun run --filter=@bossbench/web typecheck`
- `bun run --filter=@bossbench/web build`
- `bun run lint`
- `git diff --check && git status --short`

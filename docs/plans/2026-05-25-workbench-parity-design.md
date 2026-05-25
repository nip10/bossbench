# Workbench parity design

Date: 2026-05-25

## Goal

Bring Bossbench closer to the current Workbench project structure and release quality while preserving pg-boss-native behavior. Bossbench should feel like the pg-boss counterpart to Workbench, not just an inspired prototype.

## Scope

The current Workbench upstream has expanded beyond the original Hono-only BullMQ dashboard. Bossbench parity now requires work across marketing, core server architecture, CLI, adapters, examples, tests, and possibly desktop.

## Issues

Created GitHub issues:

- #1 Replace `apps/web` placeholder with Workbench-style Next.js marketing site
- #2 Refactor core server/API architecture to match current Workbench
- #3 Expand CLI to Workbench-style interactive multi-framework initializer
- #4 Add missing adapter packages: Fastify, Elysia, NestJS, Next.js
- #5 Add framework examples matching current Workbench examples
- #6 Port reusable Workbench dashboard UI components to Bossbench
- #7 Add smoke test script for package/adapters/examples
- #8 Evaluate and plan Bossbench desktop app parity

## Design direction

### 1. Marketing app parity

Replace the current Vite placeholder under `apps/web` with a Next.js app modeled after upstream Workbench:

- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/copy-command.tsx`
- `src/components/action-button.tsx`
- `src/components/mockups.tsx`
- `src/components/theme-provider.tsx`
- `src/components/theme-toggle.tsx`
- `src/components/logos/*`

Copy and visuals should be adapted to Bossbench and pg-boss, while the structure and brand feel should stay close to Workbench.

### 2. Core server architecture parity

Move duplicated adapter logic into core server modules, following Workbench's current shape:

- `src/server/base-path.ts`
- `src/server/basic-auth.ts`
- `src/server/static-assets.ts`
- `src/server/hono-api-app.ts`
- `src/server/hono-app.ts`
- `src/api/handlers.ts`
- `src/api/fetch-handler.ts`
- `src/ui-dist.ts`

The handlers remain pg-boss-native and call the existing repository/action layers.

### 3. CLI parity

Upgrade the CLI from a basic initializer to a Workbench-style interactive initializer:

- `@clack/prompts` and `picocolors`
- framework detection for Hono, Express, Fastify, Elysia, NestJS, and Next.js
- per-framework injectors
- generated password
- detected package manager install
- optional Postgres docker compose generation
- clear manual snippets when injection is not possible

### 4. Adapter parity

Add missing adapters:

- `@bossbench/fastify`
- `@bossbench/elysia`
- `@bossbench/nestjs`
- `@bossbench/next`

All should use the shared core server/fetch-handler path where possible.

### 5. Examples parity

Add examples matching the supported adapter set:

- `examples/with-hono`
- `examples/with-express`
- `examples/with-fastify`
- `examples/with-elysia`
- `examples/with-nestjs`
- `examples/with-next`

Keep the existing seeded demo as a quick validation path.

### 6. Dashboard component parity

Port reusable Workbench dashboard components where they apply to pg-boss:

- JSON viewer
- status badge
- relative time
- sortable headers
- empty state
- smart search
- metrics cards
- bulk action bar for pg-boss-supported actions

Do not port BullMQ-only flows/DAG/promote/paused-queue concepts unless there is a real pg-boss equivalent.

### 7. Smoke tests

Add `scripts/smoke.ts` and root `bun run smoke` to exercise builds, adapters, and demo endpoints.

### 8. Desktop app

Treat desktop as a separate decision track. Workbench now ships a Tauri desktop app; Bossbench needs an explicit decision about whether a Postgres/pg-boss desktop app is worth the scope.

## Implementation order

1. Fix `apps/web` first because it is visibly inconsistent with Workbench.
2. Refactor core server architecture before adding more adapters.
3. Upgrade CLI and add missing adapter packages.
4. Add matching examples and smoke tests.
5. Continue dashboard component parity.
6. Decide desktop separately.

## Verification

Each track must keep these passing:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run test:integration`
- `bun run build`

Release tracks should also run package dry-runs where package metadata changes.

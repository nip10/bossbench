# Adapter Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Nuxt/Nitro, AdonisJS, and TanStack Start adapter parity with packages, examples, CLI support, docs, and smoke coverage.

**Architecture:** Implement Nuxt as a thin h3 wrapper, Adonis as a mount helper that adapts Adonis route contexts to Bossbench requests, and TanStack Start as a server-route handler object. Keep package work independent first, then integrate shared CLI/smoke/docs/lockfile updates centrally.

**Tech Stack:** Bun workspaces, TypeScript, tsup, Vitest, h3/Nitro route handlers, AdonisJS router context, TanStack Start server routes.

---

## Task 1: Nuxt/Nitro adapter package and example

**Files:**
- Create: `packages/nuxt/**`
- Create: `examples/with-nuxt/**`

**Steps:**
1. Add tests first for `@bossbench/nuxt` returning an h3-compatible handler that serves `/jobs` HTML and `/jobs/api/config` when mounted via h3.
2. Implement `packages/nuxt/src/index.ts` as a thin re-export/wrapper around `@bossbench/h3`.
3. Add package manifest, tsconfig, tsup config, README, LICENSE.
4. Add minimal Nuxt/Nitro example files: `server/utils/bossbench.ts`, `server/routes/jobs.ts`, `server/routes/jobs/[...].ts`, package manifest, README.
5. Run package tests/typecheck/build.

## Task 2: AdonisJS adapter package and example

**Files:**
- Create: `packages/adonis/**`
- Create: `examples/with-adonis/**`

**Steps:**
1. Add tests first with a fake router verifying `mountBossbench(router, "/jobs", options)` registers bare and wildcard routes.
2. Add handler tests with lightweight fake context where feasible.
3. Implement mount helper using existing Bossbench fetch/app primitives.
4. Add package manifest, tsconfig, tsup config, README, LICENSE.
5. Add minimal example `start/routes.ts`, queue/bootstrap placeholder, package manifest, README.
6. Run package tests/typecheck/build.

## Task 3: TanStack Start adapter package and example

**Files:**
- Create: `packages/tanstack-start/**`
- Create: `examples/with-tanstack-start/**`

**Steps:**
1. Add tests first for returned method handlers serving config/html from `{ request }` inputs.
2. Implement route handler object with `GET`, `POST`, `PUT`, `PATCH`, `DELETE` using Bossbench fetch/app primitives and base path handling.
3. Add package manifest, tsconfig, tsup config, README, LICENSE.
4. Add minimal example `src/lib/bossbench-handlers.ts`, `src/routes/jobs.ts`, `src/routes/jobs/$.ts`, package manifest, README.
5. Run package tests/typecheck/build.

## Task 4: Shared CLI integration

**Files:**
- Modify: `packages/cli/src/lib/framework-detect.ts`
- Modify: `packages/cli/src/lib/inject/registry.ts`
- Create: `packages/cli/src/lib/inject/nuxt.ts`
- Create: `packages/cli/src/lib/inject/adonis.ts`
- Create: `packages/cli/src/lib/inject/tanstack-start.ts`
- Modify: `packages/cli/src/injectors.test.ts`
- Modify: `packages/cli/src/framework-detect.test.ts`
- Modify: `packages/cli/src/index.test.ts`
- Modify: `packages/cli/src/commands/init.ts`

**Steps:**
1. Add failing detection tests for Nuxt, AdonisJS, and TanStack Start.
2. Add failing injector/scaffold tests for all three.
3. Implement detection and injection/scaffolding.
4. Mark adapter packages as available in install guidance.
5. Run CLI tests.

## Task 5: Shared docs/smoke/tracker/lockfile integration

**Files:**
- Modify: `README.md`
- Modify: `docs/workbench-parity-tracker.md`
- Modify: `scripts/smoke.ts`
- Modify: `bun.lock`

**Steps:**
1. Run `bun install` to update lockfile after adding packages/examples.
2. Add new packages to smoke package import and dist checks.
3. Update README feature/package/example lists.
4. Mark Nuxt/Adonis/TanStack rows implemented/adapted in parity tracker.
5. Run smoke.

## Task 6: Verification and review

Run:

```bash
bun run lint
bun run typecheck
bun run test
bun run smoke
git diff --check
```

Then request @oracle review focused on adapter correctness, framework API assumptions, package exports, CLI scaffolds, and scope control.

## Task 7: PR

Commit, push, and create a PR referencing #62, #63, and #64.

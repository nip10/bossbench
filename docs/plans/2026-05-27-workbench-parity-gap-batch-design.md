# Workbench parity gap batch design

Date: 2026-05-27

## Context

The latest upstream audit compares Bossbench against `pontusab/workbench@e4bab1d`. The new non-desktop gaps are documented in `docs/workbench-parity-tracker.md`. Desktop parity already has open issues (#14, #29-#34), so this batch excludes desktop work.

## Goals

- Create GitHub issues for all newly identified non-desktop Workbench parity gaps.
- Start implementation with parallel subagents on independent, low-conflict workstreams.
- Keep pg-boss safety and read-only behavior ahead of feature mimicry.
- Update documentation and tests with each implemented surface.

## Issues to create

1. **[Parity] Add standalone Docker deployment**
   - Add a standalone app or package entrypoint for connecting to an external pg-boss database.
   - Default to read-only or require explicit writable configuration.
   - Add Dockerfile and evaluate GHCR workflow support.
   - Update docs and smoke coverage where practical.

2. **[Parity] Show failed reason snippets in job lists**
   - Add a short failure/output reason to job summary DTOs where safe.
   - Render snippets in Jobs and queue-specific job lists when relevant.
   - Add repository/API/UI tests.

3. **[Parity] Improve dashboard command-center polish**
   - Add richer attention alerts, live/refresh cues, and optional collapsible sidebar behavior.
   - Avoid a broad shadcn rewrite unless needed.
   - Preserve current lightweight CSS/React structure.

4. **[Parity] Design pg-boss-safe queue clean semantics**
   - Define what clean completed/failed should mean for pg-boss/Postgres.
   - Specify safety defaults, read-only behavior, confirmation copy, and data-retention constraints.
   - Treat implementation as a follow-up unless the safe behavior is unambiguous.

5. **[Parity] Design manual enqueue/requeue flow**
   - Define a safe manual enqueue API/UI for pg-boss.
   - Include clone-from-job behavior where possible.
   - Preserve auth/read-only constraints and avoid unsafe arbitrary production writes by default.

6. **[Adapter] Add h3 adapter**
   - Add first-party h3 support as the first adapter expansion.
   - Include package, example, smoke/entrypoint tests, and CLI detection if feasible.

7. **[Adapter] Add Nuxt/Nitro integration**
   - Build on the h3 adapter with a thin wrapper or documented Nitro route pattern.
   - Keep this separate because it depends on h3.

8. **[Adapter] Evaluate/Add AdonisJS adapter**
   - Evaluate AdonisJS route/middleware integration for Bossbench.
   - Implement package, example, and CLI scaffold only if the adapter shape is clean.

9. **[Adapter] Evaluate/Add TanStack Start adapter**
   - Evaluate TanStack Start server-route integration for Bossbench.
   - Implement package, example, and CLI scaffold only if the adapter shape is clean.

## First parallel implementation wave

Start four independent workstreams:

1. **Standalone Docker app**
   - Scope: standalone app shape, env handling, Dockerfile, docs, and smoke strategy.
   - Expected files: `apps/standalone/**`, root/package workspace config, docs/README, Docker-related files.

2. **Failed reason snippets**
   - Scope: repository DTO, API serialization, UI rendering, tests.
   - Expected files: `packages/core/src/core/**`, `packages/core/src/api/**`, `packages/core/src/ui/**`, related tests.

3. **h3 adapter**
   - Scope: package, basic example, tests, CLI detection/injection where feasible.
   - Expected files: `packages/h3/**`, `examples/with-h3/**`, `packages/cli/**`, smoke script.

4. **Dashboard command-center polish**
   - Scope: incremental UX improvements with minimal conflict: attention alert presentation, live refresh timestamp, and sidebar behavior if isolated.
   - Expected files: `packages/core/src/ui/**`.

## Deferred or dependent work

- Queue clean and manual enqueue/requeue need safety design before mutation implementation.
- Nuxt depends on the h3 adapter.
- AdonisJS and TanStack Start can begin as evaluations after the first wave starts, but should not block core parity work.
- Desktop remains tracked by existing issues and is out of scope for this batch.

## Integration strategy

- Use parallel subagents only for independent folders or clearly bounded changes.
- The orchestrator integrates results, resolves conflicts, updates tracker issue links, and runs verification.
- Prefer small, testable increments over large parity rewrites.
- Keep pg-boss-native semantics rather than copying BullMQ-only behavior.

## Verification

- Run targeted unit tests for each touched package.
- Run typecheck for touched packages or the full monorepo when feasible.
- Run smoke checks for new adapters/apps.
- Run `git diff --check` before reporting completion.

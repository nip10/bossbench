# App Web Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the placeholder Bossbench marketing app with a Workbench-style Next.js marketing site adapted to pg-boss.

**Architecture:** Convert `apps/web` from Vite to Next.js App Router. Port the structure of upstream Workbench's web app (`src/app/page.tsx`, `layout.tsx`, `globals.css`, components, logos, theme provider/toggle) while changing copy, supported frameworks, and mockups to Bossbench/pg-boss.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Geist fonts, lucide-react, Bun workspaces.

---

## Reference

Use current Workbench source at:

```txt
/var/folders/3b/c2hlwbw17pd_1wzj2ywz6kth0000gn/T/opencode/workbench-inspect/apps/web
```

Bossbench target:

```txt
/Users/dc/dev/bossbench/apps/web
```

## Task 1: Convert apps/web package to Next.js

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/postcss.config.js`
- Delete: `apps/web/index.html`
- Delete: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`

**Steps:**
1. Update `apps/web/package.json` scripts to match Workbench:
   - `dev`: `next dev --port 3100`
   - `build`: `next build`
   - `start`: `next start`
   - `typecheck`: `tsc --noEmit`
   - `lint`: `biome check .`
2. Add dependencies: `next`, `geist`, `lucide-react`.
3. Add dev dependencies: `@tailwindcss/postcss`, `postcss`, `tailwindcss`, `@types/node`.
4. Add `postcss.config.js` using `@tailwindcss/postcss`.
5. Delete the Vite `index.html` and `src/main.tsx` placeholder.
6. Create app router files.
7. Run `bun install`.
8. Run `bun run --filter=@bossbench/web typecheck` and `bun run --filter=@bossbench/web build`.

## Task 2: Port Workbench-style layout and global styles

**Files:**
- Create/modify: `apps/web/src/app/layout.tsx`
- Create/modify: `apps/web/src/app/globals.css`
- Add assets under `apps/web/public/` if needed

**Steps:**
1. Adapt Workbench `layout.tsx`:
   - Use Geist fonts.
   - Set metadata for Bossbench.
   - Use title: `Bossbench — Open-source pg-boss dashboard`.
   - Use description: `A modern, drop-in pg-boss dashboard for Node backends.`
2. Adapt Workbench `globals.css`:
   - Keep design tokens and hero styles close to Workbench.
   - Rename Workbench-specific class text only where necessary.
3. Add app icon assets if available; otherwise use generated/simple SVG.
4. Run web build.

## Task 3: Port components

**Files:**
- Create: `apps/web/src/components/copy-command.tsx`
- Create: `apps/web/src/components/action-button.tsx`
- Create: `apps/web/src/components/mockups.tsx`
- Create: `apps/web/src/components/theme-provider.tsx`
- Create: `apps/web/src/components/theme-toggle.tsx`
- Create: `apps/web/src/components/logos/index.ts`
- Create/update logos for Hono, Express, Fastify, Elysia, NestJS, Next.js

**Steps:**
1. Port reusable Workbench components with Bossbench names/copy.
2. Keep the visual structure close; adapt product terms to pg-boss.
3. Do not include BullMQ-specific copy.
4. Run `bun run --filter=@bossbench/web typecheck`.

## Task 4: Build Bossbench landing page

**Files:**
- Modify: `apps/web/src/app/page.tsx`

**Steps:**
1. Port the Workbench page structure:
   - nav with `bossbench` and GitHub link
   - hero headline
   - copy command
   - framework row
   - mockup sections
2. Adapt headline:
   - `a beautiful, open-source pg-boss dashboard for modern Node apps.`
3. Use command:
   - `npx @bossbench/cli init`
4. Supported frameworks should reflect target parity:
   - Hono, Express, Fastify, Elysia, NestJS, Next.js
5. Add copy for SQL-backed reads and pg-boss-backed actions.
6. Run web build.

## Task 5: Verify and commit

**Commands:**

```bash
bun run lint
bun run typecheck
bun run test
bun run test:integration
bun run build
```

Expected: all pass.

Then commit:

```bash
git add apps/web package.json bun.lock
git commit -m "feat: align web app with workbench"
git push
```

## Notes

- Do not implement desktop in this task.
- Do not add missing adapters in this task.
- The goal is to fix the visible `apps/web` mismatch first.

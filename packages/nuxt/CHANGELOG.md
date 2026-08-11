# @bossbench/nuxt

## 1.0.2

### Patch Changes

- fd1989e: Republish only, no code changes. `@bossbench/nuxt@1.0.1` (the previous republish
  attempting to fix its `workspace:*` dependency) shipped depending on
  `@bossbench/h3@1.0.0` instead of the already-fixed `@bossbench/h3@1.0.1`, because the
  lockfile hadn't been refreshed before packing (see #95, now fixed for future releases).
  `@bossbench/h3@1.0.0` is itself still broken, so this made `@bossbench/nuxt` uninstallable
  too. Forces a republish through the now-fixed pipeline.

## 1.0.1

### Patch Changes

- 882fdea: Republish only, no code changes. Every one of these was published before the release
  pipeline fix (#88/#89) landed, so each still carries an unresolved `"workspace:*"`
  dependency on npm (`@bossbench/core` for most, `@bossbench/h3` for `@bossbench/nuxt`)
  and is uninstallable (`npm error EUNSUPPORTEDPROTOCOL`) — same issue already fixed for
  `@bossbench/express@2.0.1`. This forces a republish of all of them through the fixed
  pipeline. `@bossbench/core`, `@bossbench/cli`, and `@bossbench/mcp` don't depend on any
  other workspace package, so they were never affected and aren't included here.
- Updated dependencies [882fdea]
  - @bossbench/h3@1.0.1

## 1.0.0

### Major Changes

- cb004d6: Initial Bossbench release with pg-boss dashboard core, Hono, Express, Fastify, Elysia, NestJS, Next.js, AdonisJS, h3, Nuxt, and TanStack Start adapters, CLI initializer, Workbench-style UI, smoke checks, and integration tests.

### Patch Changes

- Updated dependencies [cb004d6]
  - @bossbench/h3@1.0.0

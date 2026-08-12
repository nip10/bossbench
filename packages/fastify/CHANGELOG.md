# @bossbench/fastify

## 1.0.3

### Patch Changes

- Updated dependencies [3eb4650]
- Updated dependencies [ea53cae]
- Updated dependencies [7198ab4]
- Updated dependencies [6569aca]
- Updated dependencies [ba9c943]
  - @bossbench/core@1.1.1

## 1.0.2

### Patch Changes

- Updated dependencies [4004412]
  - @bossbench/core@1.1.0

## 1.0.1

### Patch Changes

- 882fdea: Republish only, no code changes. Every one of these was published before the release
  pipeline fix (#88/#89) landed, so each still carries an unresolved `"workspace:*"`
  dependency on npm (`@bossbench/core` for most, `@bossbench/h3` for `@bossbench/nuxt`)
  and is uninstallable (`npm error EUNSUPPORTEDPROTOCOL`) — same issue already fixed for
  `@bossbench/express@2.0.1`. This forces a republish of all of them through the fixed
  pipeline. `@bossbench/core`, `@bossbench/cli`, and `@bossbench/mcp` don't depend on any
  other workspace package, so they were never affected and aren't included here.

## 1.0.0

### Major Changes

- cb004d6: Initial Bossbench release with pg-boss dashboard core, Hono, Express, Fastify, Elysia, NestJS, Next.js, AdonisJS, h3, Nuxt, and TanStack Start adapters, CLI initializer, Workbench-style UI, smoke checks, and integration tests.

### Patch Changes

- Updated dependencies [cb004d6]
  - @bossbench/core@1.0.0

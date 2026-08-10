# @bossbench/express

## 2.0.0

### Major Changes

- 9aef9e2: Target Express 5 instead of Express 4. The adapter's internal asset and SPA-fallback
  routes used bare string wildcards ("_"), which are Express-4-only path-to-regexp syntax —
  Express 5's path-to-regexp v6+ rejects a bare "_" at route-registration time
  ("Missing parameter name"), so every request into a mounted dashboard 500'd on Express 5.
  Those routes now use RegExp paths instead, which bypass string-pattern parsing and work
  the same way `req.params[0]` did under the old wildcard.

  This is a breaking change for anyone still on Express 4: `peerDependencies.express` is now
  `>=5.0.0` (was `>=4.0.0`), and the dev/test toolchain now runs against Express 5. Express 4
  users should stay on `@bossbench/express@1.x`.

## 1.0.0

### Major Changes

- cb004d6: Initial Bossbench release with pg-boss dashboard core, Hono, Express, Fastify, Elysia, NestJS, Next.js, AdonisJS, h3, Nuxt, and TanStack Start adapters, CLI initializer, Workbench-style UI, smoke checks, and integration tests.

### Patch Changes

- Updated dependencies [cb004d6]
  - @bossbench/core@1.0.0

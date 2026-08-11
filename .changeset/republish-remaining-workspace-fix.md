---
"@bossbench/adonis": patch
"@bossbench/elysia": patch
"@bossbench/fastify": patch
"@bossbench/h3": patch
"@bossbench/hono": patch
"@bossbench/nestjs": patch
"@bossbench/next": patch
"@bossbench/nuxt": patch
"@bossbench/tanstack-start": patch
---

Republish only, no code changes. Every one of these was published before the release
pipeline fix (#88/#89) landed, so each still carries an unresolved `"workspace:*"`
dependency on npm (`@bossbench/core` for most, `@bossbench/h3` for `@bossbench/nuxt`)
and is uninstallable (`npm error EUNSUPPORTEDPROTOCOL`) — same issue already fixed for
`@bossbench/express@2.0.1`. This forces a republish of all of them through the fixed
pipeline. `@bossbench/core`, `@bossbench/cli`, and `@bossbench/mcp` don't depend on any
other workspace package, so they were never affected and aren't included here.

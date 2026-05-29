# Adapter expansion design

Date: 2026-05-29

Issues: [#62](https://github.com/nip10/bossbench/issues/62), [#63](https://github.com/nip10/bossbench/issues/63), [#64](https://github.com/nip10/bossbench/issues/64)

## Context

Bossbench already ships Hono, h3, Express, Fastify, Elysia, NestJS, and Next.js adapters. The remaining Workbench adapter parity gaps are Nuxt/Nitro, AdonisJS, and TanStack Start. Upstream Workbench implements these as thin route integration layers; Bossbench should preserve the mount ergonomics while adapting options to pg-boss/Postgres instead of BullMQ queue arrays.

## Goals

- Add first-party adapter packages for Nuxt/Nitro, AdonisJS, and TanStack Start when the adapter shape is clean.
- Add minimal examples for each adapter.
- Add CLI detection/injection or scaffolding for each framework.
- Add smoke coverage and package docs.
- Reuse existing Bossbench core/h3/Next-like primitives rather than duplicating dashboard behavior.

## Non-goals

- No new pg-boss behavior.
- No queue clean/manual enqueue changes.
- No full worker/demo data seeding for each new example unless trivial.
- No framework-specific authorization layer beyond existing Bossbench auth/read-only options.
- No support for unsupported legacy framework routing modes.

## Nuxt/Nitro adapter

Nuxt/Nitro should be the lowest-risk adapter. Implement `@bossbench/nuxt` as a thin wrapper over `@bossbench/h3`:

```ts
import { bossbench } from "@bossbench/nuxt";

export default bossbench({
  db: process.env.DATABASE_URL!,
  basePath: "/jobs",
  auth: { username, password },
});
```

Mount pattern:

- `server/utils/bossbench.ts` exports the handler.
- `server/routes/jobs.ts` exports the bare mount.
- `server/routes/jobs/[...].ts` exports the catch-all mount.

Rationale: this reuses h3 request handling, base path stripping, auth, assets, and API behavior.

## AdonisJS adapter

Implement `@bossbench/adonis` if the route API stays small:

```ts
import { mountBossbench } from "@bossbench/adonis";
import router from "@adonisjs/core/services/router";

mountBossbench(router, "/jobs", options);
```

Adapter behavior:

- register both the bare mount and a wildcard route;
- translate Adonis request context into a standard `Request`;
- call a shared Bossbench fetch/app handler;
- translate `Response` back through Adonis response object.

Risk: Adonis 6/7 typing and wildcard route semantics. Keep tests focused on route registration and handler conversion using lightweight fakes. If this becomes too coupled to Adonis internals, document evaluation and defer full implementation.

## TanStack Start adapter

Implement `@bossbench/tanstack-start` as a route-handler object, similar to the Next adapter but with TanStack Start server-route signatures:

```ts
import { bossbench } from "@bossbench/tanstack-start";

export const handlers = bossbench(options);
```

Scaffold pattern:

- `src/lib/bossbench-handlers.ts` exports `handlers`.
- `src/routes/jobs.ts` registers the bare route.
- `src/routes/jobs/$.ts` registers the splat route.

Risk: TanStack Start APIs move quickly. Keep the package minimal, with tests against plain `{ request }` handler invocation and scaffolding text rather than deep framework runtime tests.

## CLI design

Extend existing detection and injection patterns:

- Nuxt: detect `nuxt.config.*`; scaffold `server/utils` and two server route files.
- Adonis: detect `start/routes.ts` or `adonisrc.*`; inject `mountBossbench(router, mount, options)` into routes.
- TanStack Start: detect `@tanstack/react-start` or `@tanstack/start` plus route/vite structure; scaffold lib handlers and route files.

All snippets must preserve the current auth guard pattern and include `basePath` matching the mount path.

## Verification

- Unit tests for each adapter package.
- CLI detection/injector tests for all three frameworks.
- Package entrypoint smoke imports.
- Typecheck, lint, tests, and smoke.

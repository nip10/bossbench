# Additional adapter evaluation design

## Decision

Do not copy all upstream Workbench adapters immediately. Bossbench should add adapters only when they increase pg-boss adoption without creating maintenance drag.

## Recommended order

1. **h3** — highest leverage. h3 is the common HTTP layer behind Nitro/Nuxt-style runtimes and can unlock multiple ecosystems with one small adapter.
2. **Nuxt** — only after h3, as a thin Nuxt/Nitro wrapper or documented h3 usage.
3. **Koa** — low-risk but lower strategic value. Add if requested by users.
4. **Bun** — prefer examples first. Hono and Elysia already cover many Bun deployments.
5. **Astro** — defer. Astro is less natural for a mutable operational dashboard unless demand appears.

## Non-goals

- No adapter sprawl just for parity.
- No bespoke runtime-specific code when a shared h3 adapter can cover it.
- No adapter release without smoke tests and docs.

## Acceptance criteria before adding any adapter

- A clear framework integration point exists for all HTTP methods used by Bossbench.
- The adapter preserves `basePath`, auth, readonly, and all mutation semantics.
- The package has README, example app, tsup build, typecheck, and smoke coverage.
- CLI detection/injection is either implemented or explicitly deferred.

## Proposed first implementation

Create `@bossbench/h3` before Nuxt. It should adapt Bossbench's existing fetch-style handler into h3 event handlers and include a small h3 example. After that, evaluate whether Nuxt needs a package or can use documented h3/Nitro routing.

## Tracking

- GitHub issue: #41
- Upstream audit range: `5e1bbf3..237beaf`

# @bossbench/core

## 1.1.1

### Patch Changes

- 3eb4650: Continue the dashboard visual pass: fix missing padding around Attention and
  Health Signals card grids, strengthen type hierarchy (bigger page title and
  Attention values, heavier panel titles), add a colored accent for the active
  sidebar item, add tone icons to Attention and Queue health cards, add a real
  throughput area chart and a job-state donut chart to the Overview page (using
  `recharts`, previously an unused dependency, and `overview.totals` data that
  was already fetched but discarded), strengthen table header contrast, add
  colored trend badges to the Health Signals metric cards, and add First/Last
  buttons and a page-count label to the Jobs and Future Jobs pagination
  footers. No API or behavior changes.
- ea53cae: Redesign the dashboard's visual system: neutral near-black palette (no more
  blue tint), monospace type throughout, sharper corners, and restrained status
  color (small colored square + text instead of glowing gradient cards/pill
  badges). No API or behavior changes.
- 7198ab4: Fix four visual bugs: the light/dark theme toggle did nothing because
  `:root` and `.dark` had become identical dark palettes — `:root` is now a
  real light theme, and job-state/trend/JSON-syntax colors moved to
  theme-aware CSS variables so they stay legible in both modes. The job
  detail Timeline's event markers had no visible fill (`hsl(var(--primary))`
  on a non-HSL variable) and no connecting line between events — both fixed.
  The Activity page's plain text/bar-row list is now a real stacked
  time-series chart (created/completed/failed). The Overview job-state donut
  chart's tooltip had invisible text (no color set against a dark background)
  and was given its own full-width row that left a large blank gap — now
  uses theme-aware colors and sits beside the throughput chart instead.
- 6569aca: Fix two more visual bugs found in light mode: `TooltipContent` (sidebar
  nav, sidebar queue list, and relative-timestamp tooltips throughout job
  tables) had no styling anywhere in the codebase, so it rendered
  transparent/see-through over other content. Added a solid background,
  border, and shadow. Also fixed the job-state donut chart's center
  "total" label, which used CSS grid `place-items: center` on two stacked
  children and let the implicit row tracks spread across the full chart
  height instead of packing tightly together.
- ba9c943: Fix a layout bug on Jobs, Future Jobs, and Schedules: their filter
  forms were rendered in the page header's compact single-line "actions"
  slot next to the title, which forced that row to match the tall form's
  height and left a large blank gap beside the short title. `Section` now
  accepts a `filters` prop that renders the form as its own full-width row
  below the title instead.

## 1.1.0

### Minor Changes

- 4004412: Add a collapsible mobile sidebar drawer (the sidebar previously disappeared below
  720px with no way to reopen it), persist job list filters (queue, state, from/to,
  tags, limit/offset, sort) to the URL via `nuqs` so filtered views are shareable and
  survive reload, and add multi-database support: `BossbenchOptions` and `/config`
  now carry an optional `databases`/`activeDatabaseId` list, and the dashboard shows
  a database selector in the header when more than one is configured. The standalone
  app (`@bossbench/standalone`, private/unpublished) uses this to serve multiple
  databases from one deployment via pipe-separated `DATABASE_URL` entries and a `db`
  query param. Single-database deployments are unaffected.

## 1.0.0

### Major Changes

- cb004d6: Initial Bossbench release with pg-boss dashboard core, Hono, Express, Fastify, Elysia, NestJS, Next.js, AdonisJS, h3, Nuxt, and TanStack Start adapters, CLI initializer, Workbench-style UI, smoke checks, and integration tests.

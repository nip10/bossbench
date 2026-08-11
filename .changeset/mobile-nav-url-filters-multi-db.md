---
"@bossbench/core": minor
---

Add a collapsible mobile sidebar drawer (the sidebar previously disappeared below
720px with no way to reopen it), persist job list filters (queue, state, from/to,
tags, limit/offset, sort) to the URL via `nuqs` so filtered views are shareable and
survive reload, and add multi-database support: `BossbenchOptions` and `/config`
now carry an optional `databases`/`activeDatabaseId` list, and the dashboard shows
a database selector in the header when more than one is configured. The standalone
app (`@bossbench/standalone`, private/unpublished) uses this to serve multiple
databases from one deployment via pipe-separated `DATABASE_URL` entries and a `db`
query param. Single-database deployments are unaffected.

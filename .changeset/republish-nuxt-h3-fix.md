---
"@bossbench/nuxt": patch
---

Republish only, no code changes. `@bossbench/nuxt@1.0.1` (the previous republish
attempting to fix its `workspace:*` dependency) shipped depending on
`@bossbench/h3@1.0.0` instead of the already-fixed `@bossbench/h3@1.0.1`, because the
lockfile hadn't been refreshed before packing (see #95, now fixed for future releases).
`@bossbench/h3@1.0.0` is itself still broken, so this made `@bossbench/nuxt` uninstallable
too. Forces a republish through the now-fixed pipeline.

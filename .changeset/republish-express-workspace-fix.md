---
"@bossbench/express": patch
---

Republish only. `@bossbench/express@2.0.0` was published before the release
pipeline fix (workspace:\* now resolved correctly via `bun pm pack` + `npm publish`),
so it shipped with an unresolved `"@bossbench/core": "workspace:*"` dependency and is
uninstallable (`npm error EUNSUPPORTEDPROTOCOL`). No code changes — this just forces a
new publish through the fixed pipeline.

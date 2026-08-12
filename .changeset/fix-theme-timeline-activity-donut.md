---
"@bossbench/core": patch
---

Fix four visual bugs: the light/dark theme toggle did nothing because
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

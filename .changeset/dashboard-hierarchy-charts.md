---
"@bossbench/core": patch
---

Continue the dashboard visual pass: fix missing padding around Attention and
Health Signals card grids, strengthen type hierarchy (bigger page title and
Attention values, heavier panel titles), add a colored accent for the active
sidebar item, add tone icons to Attention and Queue health cards, add a real
throughput area chart and a job-state donut chart to the Overview page (using
`recharts`, previously an unused dependency, and `overview.totals` data that
was already fetched but discarded), strengthen table header contrast, add
colored trend badges to the Health Signals metric cards, and add First/Last
buttons and a page-count label to the Jobs and Future Jobs pagination
footers. No API or behavior changes.

---
"@bossbench/core": patch
---

Fix two more visual bugs found in light mode: `TooltipContent` (sidebar
nav, sidebar queue list, and relative-timestamp tooltips throughout job
tables) had no styling anywhere in the codebase, so it rendered
transparent/see-through over other content. Added a solid background,
border, and shadow. Also fixed the job-state donut chart's center
"total" label, which used CSS grid `place-items: center` on two stacked
children and let the implicit row tracks spread across the full chart
height instead of packing tightly together.

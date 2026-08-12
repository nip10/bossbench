---
"@bossbench/core": patch
---

Fix a layout bug on Jobs, Future Jobs, and Schedules: their filter
forms were rendered in the page header's compact single-line "actions"
slot next to the title, which forced that row to match the tall form's
height and left a large blank gap beside the short title. `Section` now
accepts a `filters` prop that renders the form as its own full-width row
below the title instead.

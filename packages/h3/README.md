# @bossbench/h3

H3 adapter for Bossbench.

## Usage

```ts
import { bossbench } from "@bossbench/h3";
import { createApp } from "h3";

const handler = bossbench({
  db: process.env.DATABASE_URL!,
  basePath: "/jobs",
  auth: {
    username: process.env.BOSSBENCH_USER!,
    password: process.env.BOSSBENCH_PASS!,
  },
});

export default createApp().use("/jobs", handler).use("/jobs/**", handler);
```

Register both the bare mount path and `/**` catch-all so h3 serves the dashboard root and nested client routes.

# @bossbench/express

Express adapter for Bossbench.

```ts
import express from "express";
import PgBoss from "pg-boss";
import { bossbench } from "@bossbench/express";

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss" });
await boss.start();

const app = express();

app.use(
  "/jobs",
  bossbench({
    boss,
    db: process.env.DATABASE_URL!,
    basePath: "/jobs",
    auth: {
      username: process.env.BOSSBENCH_USER!,
      password: process.env.BOSSBENCH_PASS!,
    },
  }),
);

export default app;
```

# @bossbench/elysia

Elysia adapter for Bossbench.

```bash
npm install @bossbench/elysia pg pg-boss
```

```ts
import { Elysia } from "elysia";
import PgBoss from "pg-boss";
import { bossbench } from "@bossbench/elysia";

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss" });
await boss.start();

const app = new Elysia();

app.mount(
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
```

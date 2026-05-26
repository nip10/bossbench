# @bossbench/next

Next.js App Router adapter for Bossbench.

```bash
npm install @bossbench/next pg pg-boss
```

Create a catch-all route such as `src/app/jobs/[[...path]]/route.ts`:

```ts
import PgBoss from "pg-boss";
import { bossbench } from "@bossbench/next";

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss" });
await boss.start();

export const { DELETE, GET, PATCH, POST, PUT } = bossbench({
  boss,
  db: process.env.DATABASE_URL!,
  basePath: "/jobs",
  auth: {
    username: process.env.BOSSBENCH_USER!,
    password: process.env.BOSSBENCH_PASS!,
  },
});
```

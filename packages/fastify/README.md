# @bossbench/fastify

Fastify adapter for Bossbench.

```bash
npm install @bossbench/fastify pg pg-boss
```

```ts
import Fastify from "fastify";
import PgBoss from "pg-boss";
import { bossbench } from "@bossbench/fastify";

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss" });
await boss.start();

const app = Fastify();

await app.register(
  bossbench({
    boss,
    db: process.env.DATABASE_URL!,
    basePath: "/jobs",
    auth: {
      username: process.env.BOSSBENCH_USER!,
      password: process.env.BOSSBENCH_PASS!,
    },
  }),
  { prefix: "/jobs" },
);
```

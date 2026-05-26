# @bossbench/nestjs

NestJS helper for mounting Bossbench on Express or Fastify-backed Nest apps.

```bash
npm install @bossbench/nestjs @bossbench/express @bossbench/fastify pg pg-boss
```

```ts
import { NestFactory } from "@nestjs/core";
import PgBoss from "pg-boss";
import { bossbench } from "@bossbench/nestjs";
import { AppModule } from "./app.module";

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss" });
await boss.start();

const app = await NestFactory.create(AppModule);

await bossbench(app, "/jobs", {
  boss,
  db: process.env.DATABASE_URL!,
  basePath: "/jobs",
  auth: {
    username: process.env.BOSSBENCH_USER!,
    password: process.env.BOSSBENCH_PASS!,
  },
});
```

# @bossbench/adonis

AdonisJS adapter for Bossbench.

## Usage

```ts
import { mountBossbench } from "@bossbench/adonis";

mountBossbench(router, "/jobs", {
  db: process.env.DATABASE_URL!,
  allowUnauthenticated: true,
});
```

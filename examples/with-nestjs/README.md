# Bossbench with NestJS

```bash
cp .env.example .env
docker compose up -d --pull never postgres
bun run --filter=@bossbench/example-with-nestjs dev
```

Open http://localhost:3000/jobs and use the local-only credentials from `.env.example`.

This example uses the default Nest Express platform and therefore depends on `@bossbench/express`.

Change `BOSSBENCH_USER` and `BOSSBENCH_PASS` before exposing this example outside localhost.

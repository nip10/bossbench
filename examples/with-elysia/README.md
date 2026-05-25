# Bossbench with Elysia

```bash
cp .env.example .env
docker compose up -d --pull never postgres
bun run --filter=@bossbench/example-with-elysia dev
```

Open http://localhost:3000/jobs and use the local-only credentials from `.env.example`.

Change `BOSSBENCH_USER` and `BOSSBENCH_PASS` before exposing this example outside localhost.

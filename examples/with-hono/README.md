# Bossbench with Hono

```bash
cp .env.example .env
docker compose up -d --pull never postgres
bun run --filter=@bossbench/example-with-hono dev
```

Open http://localhost:3000/jobs and use the local-only credentials from `.env.example`.

Change `BOSSBENCH_USER` and `BOSSBENCH_PASS` before exposing this example outside localhost.

Minimal Hono example mounted at `/jobs`.

```bash
bun install
bun run --filter=@bossbench/example-with-hono dev
```

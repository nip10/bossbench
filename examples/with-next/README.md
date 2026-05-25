# Bossbench with Next.js

```bash
cp .env.example .env
docker compose up -d --pull never postgres
bun run --filter=@bossbench/example-with-next dev
```

Open http://localhost:3000/jobs and use the local-only credentials from `.env.example`.

Run the worker in another terminal to enqueue pg-boss work:

```bash
bun run --filter=@bossbench/example-with-next worker
```

Change `BOSSBENCH_USER` and `BOSSBENCH_PASS` before exposing this example outside localhost.

App Router catch-all example mounted at `/jobs`.

# Bossbench demo

Standalone Hono demo with seeded pg-boss data.

```bash
docker compose up -d --pull never postgres
bun install
bun run --filter=@bossbench/example-demo dev
```

Open:

- Dashboard: http://localhost:3000/jobs
- Username: `admin`
- Password: `change-me`

Environment overrides:

```bash
PORT=3001 \
DATABASE_URL=postgres://postgres:postgres@localhost:54329/bossbench \
BOSSBENCH_USER=admin \
BOSSBENCH_PASS=change-me \
bun run --filter=@bossbench/example-demo dev
```

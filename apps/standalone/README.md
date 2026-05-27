# @bossbench/standalone

Minimal standalone Bossbench app for an external pg-boss/Postgres database.

## Env

- `DATABASE_URL` required
- `PGBOSS_SCHEMA` default `pgboss`
- `BASE_PATH` default `/`
- `HOST` default `0.0.0.0`
- `PORT` default `3000`
- `BOSSBENCH_USER` / `BOSSBENCH_PASS` optional auth
- `WRITABLE=true` enables mutations only when auth is set

Without auth, the app stays read-only.

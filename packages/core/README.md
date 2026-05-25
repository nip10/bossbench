# @bossbench/core

Core package for Bossbench. It contains the pg-boss/Postgres repository, action service, API routes, and bundled dashboard UI.

Most apps should install an adapter instead:

```bash
npm install @bossbench/hono pg pg-boss
# or
npm install @bossbench/express pg pg-boss
```

## Security

Bossbench requires non-empty `auth` by default. Use `allowUnauthenticated: true` only for local development or when another middleware protects the route. Without `auth`, Bossbench defaults to read-only mode.

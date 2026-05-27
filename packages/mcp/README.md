# @bossbench/mcp

Read-only Model Context Protocol server for Bossbench.

The MCP server is a local stdio proxy. It lets MCP-aware agents inspect a running Bossbench dashboard through the dashboard HTTP API. It does not connect to Postgres directly and this first release does not expose mutation tools.

## Configure

```sh
BOSSBENCH_URL=http://localhost:3000/jobs \
BOSSBENCH_USERNAME=admin \
BOSSBENCH_PASSWORD=secret \
npx @bossbench/mcp
```

Environment variables:

- `BOSSBENCH_URL` — required dashboard mount URL, for example `http://localhost:3000/jobs`.
- `BOSSBENCH_USERNAME` / `BOSSBENCH_PASSWORD` — optional Basic Auth credentials.
- `BOSSBENCH_TOKEN` — optional Bearer token; takes precedence over Basic Auth.

## Tools

- `bossbench_get_overview`
- `bossbench_list_queues`
- `bossbench_list_jobs`
- `bossbench_list_future_jobs`
- `bossbench_get_job`
- `bossbench_search_jobs`
- `bossbench_list_schedules`
- `bossbench_list_dead_letters`
- `bossbench_list_warnings`
- `bossbench_get_metrics`
- `bossbench_get_activity`
- `bossbench_get_status`

All tools are read-only and proxy existing Bossbench API endpoints.

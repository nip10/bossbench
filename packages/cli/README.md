# @bossbench/cli

Initializer for Bossbench.

```bash
npx @bossbench/cli init
```

The CLI auto-injects Hono, Express, Fastify, Elysia, NestJS, and Next.js projects.

Flags:

- `--cwd <path>` project directory
- `--mount <path>` dashboard mount path
- `--no-auth` skip auth env vars/snippets
- `--no-docker` skip Postgres compose file (and never overwrites an existing one)
- `--yes` skip prompts
- `--dry-run` inspect without writing files

Use `--dry-run` to inspect detection without writing files.

```bash
npx @bossbench/cli init --dry-run
```

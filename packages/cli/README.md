# @bossbench/cli

Initializer for Bossbench.

```bash
npx @bossbench/cli init
```

The CLI detects Hono or Express projects, updates `.env.example`, adds Bossbench package metadata, and injects a `/jobs` mount into a common app entry file.

Use `--dry-run` to inspect detection without writing files:

```bash
npx @bossbench/cli init --dry-run
```

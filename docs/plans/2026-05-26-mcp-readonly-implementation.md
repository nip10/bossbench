# MCP Read-Only Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a read-only `@bossbench/mcp` stdio server that exposes existing Bossbench dashboard APIs to MCP-aware agents.

**Architecture:** The MCP package is a local proxy. It reads dashboard URL/auth from env, calls the existing Bossbench HTTP API, and registers read-only tools. It never imports `pg`, `pg-boss`, or writes SQL.

**Tech Stack:** TypeScript, MCP TypeScript SDK, Zod, tsup, Vitest, Bun/Turbo monorepo.

---

### Task 1: Package scaffold

Create `packages/mcp` with `package.json`, `tsconfig.json`, `tsup.config.ts`, `README.md`, and `src/index.ts`.

### Task 2: HTTP client

Create `src/client.ts` with tests for:

- dashboard URL normalization;
- `/api` path joining;
- Basic Auth headers;
- Bearer token precedence;
- non-2xx errors returning actionable messages.

### Task 3: Tool registration

Create `src/tools.ts` with tests for representative read-only tools:

- overview;
- jobs with filters;
- job detail;
- schedules;
- future jobs.

### Task 4: Stdio entrypoint

Wire `McpServer` and `StdioServerTransport` in `src/index.ts`.

### Task 5: Verification

Run:

- `bun run --filter=@bossbench/mcp test`
- `bun run --filter=@bossbench/mcp typecheck`
- `bun run --filter=@bossbench/mcp build`
- `bun run smoke`
- `bun run lint`

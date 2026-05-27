import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BossbenchApiError, type BossbenchClient } from "./client";

const CHARACTER_LIMIT = 25_000;

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function createToolResponse(result: unknown): ToolResult {
  let text = JSON.stringify(result, null, 2);
  let truncated = false;
  if (text.length > CHARACTER_LIMIT) {
    text = `${text.slice(0, CHARACTER_LIMIT)}\n... [truncated: full payload is available in structuredContent]`;
    truncated = true;
  }
  return {
    content: [{ type: "text", text }],
    structuredContent: {
      data: result,
      ...(truncated ? { truncated: true } : {}),
    },
  };
}

function errorResponse(error: unknown): ToolResult {
  const message =
    error instanceof BossbenchApiError || error instanceof Error
      ? error.message
      : String(error);
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${message}` }],
  };
}

function safe<T>(fn: (input: T) => Promise<unknown>) {
  return async (input: T) => {
    try {
      return createToolResponse(await fn(input));
    } catch (error) {
      return errorResponse(error);
    }
  };
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function registerAllTools(server: McpServer, client: BossbenchClient) {
  server.registerTool(
    "bossbench_get_overview",
    {
      title: "Get Bossbench overview",
      description: "Get queue totals, dead-letter count, and warning count.",
      inputSchema: {},
      annotations: readOnlyAnnotations,
    },
    safe(async () => client.get("/overview")),
  );

  server.registerTool(
    "bossbench_list_queues",
    {
      title: "List Bossbench queues",
      description: "List pg-boss queues with state counts.",
      inputSchema: {},
      annotations: readOnlyAnnotations,
    },
    safe(async () => client.get("/queues")),
  );

  server.registerTool(
    "bossbench_list_jobs",
    {
      title: "List Bossbench jobs",
      description: "List jobs with optional filters.",
      inputSchema: {
        queue: z.string().optional(),
        state: z.string().optional(),
        q: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: readOnlyAnnotations,
    },
    safe(async (input) => client.get("/jobs", input)),
  );

  server.registerTool(
    "bossbench_list_future_jobs",
    {
      title: "List Bossbench future jobs",
      description:
        "List concrete pg-boss jobs whose start_after is in the future.",
      inputSchema: {
        queue: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: readOnlyAnnotations,
    },
    safe(async (input) => client.get("/future-jobs", input)),
  );

  server.registerTool(
    "bossbench_get_job",
    {
      title: "Get Bossbench job",
      description: "Get a job by id.",
      inputSchema: { id: z.string().min(1) },
      annotations: readOnlyAnnotations,
    },
    safe(async ({ id }) => client.get(`/jobs/${encodeURIComponent(id)}`)),
  );

  server.registerTool(
    "bossbench_search_jobs",
    {
      title: "Search Bossbench jobs",
      description: "Search jobs by id, queue, state, or payload text.",
      inputSchema: {
        q: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: readOnlyAnnotations,
    },
    safe(async (input) => client.get("/search", input)),
  );

  const simpleTools = [
    ["bossbench_list_schedules", "List Bossbench schedules", "/schedules"],
    [
      "bossbench_list_dead_letters",
      "List Bossbench dead-letter jobs",
      "/dead-letter",
    ],
    ["bossbench_list_warnings", "List Bossbench warnings", "/warnings"],
    ["bossbench_get_metrics", "Get Bossbench metrics", "/metrics"],
    ["bossbench_get_activity", "Get Bossbench activity", "/activity"],
    ["bossbench_get_status", "Get Bossbench status/config", "/config"],
  ] as const;

  for (const [name, description, path] of simpleTools) {
    server.registerTool(
      name,
      {
        title: description,
        description,
        inputSchema: {},
        annotations: readOnlyAnnotations,
      },
      safe(async () => client.get(path)),
    );
  }
}

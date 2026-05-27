#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BossbenchClient } from "./client";
import { registerAllTools } from "./tools";

const url = process.env.BOSSBENCH_URL;
if (!url) {
  console.error("BOSSBENCH_URL is required");
  process.exit(1);
}

const server = new McpServer({ name: "bossbench", version: "0.1.0" });
registerAllTools(
  server,
  new BossbenchClient({
    url,
    ...(process.env.BOSSBENCH_USERNAME
      ? { username: process.env.BOSSBENCH_USERNAME }
      : {}),
    ...(process.env.BOSSBENCH_PASSWORD
      ? { password: process.env.BOSSBENCH_PASSWORD }
      : {}),
    ...(process.env.BOSSBENCH_TOKEN
      ? { token: process.env.BOSSBENCH_TOKEN }
      : {}),
  }),
);

await server.connect(new StdioServerTransport());

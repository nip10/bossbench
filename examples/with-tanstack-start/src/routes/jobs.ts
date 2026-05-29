import { createFileRoute } from "@tanstack/react-router";
import { DELETE, GET, PATCH, POST, PUT } from "../lib/bossbench-handlers";

export const Route = createFileRoute("/jobs" as never)({
  server: { handlers: { DELETE, GET, PATCH, POST, PUT } },
} as never);

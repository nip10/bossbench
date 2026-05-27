import { describe, expect, it, vi } from "vitest";
import { createToolResponse, registerAllTools } from "./tools";

describe("createToolResponse", () => {
  it("includes structured content and compact text", () => {
    const response = createToolResponse({ ok: true });
    expect(response.structuredContent).toEqual({ data: { ok: true } });
    expect(response.content[0]?.text).toContain("ok");
  });
});

describe("registerAllTools", () => {
  it("registers read-only tools against API endpoints", async () => {
    const registered: Record<
      string,
      { handler: (input: never) => Promise<unknown> }
    > = {};
    const server = {
      registerTool: vi.fn((name, _config, handler) => {
        registered[name] = { handler };
      }),
    };
    const client = { get: vi.fn().mockResolvedValue({ total: 1 }) };

    registerAllTools(server as never, client as never);
    await registered.bossbench_get_overview?.handler({} as never);
    await registered.bossbench_get_job?.handler({ id: "job-1" } as never);

    expect(server.registerTool).toHaveBeenCalledWith(
      "bossbench_get_overview",
      expect.objectContaining({
        annotations: expect.objectContaining({ readOnlyHint: true }),
      }),
      expect.any(Function),
    );
    expect(client.get).toHaveBeenCalledWith("/overview");
    expect(client.get).toHaveBeenCalledWith("/jobs/job-1");
  });
});

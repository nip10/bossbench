import { describe, expect, it, vi } from "vitest";
import { BossbenchClient, normalizeDashboardUrl } from "./client";

describe("normalizeDashboardUrl", () => {
  it("appends api once", () => {
    expect(normalizeDashboardUrl("http://localhost:3000/jobs")).toBe(
      "http://localhost:3000/jobs/api",
    );
    expect(normalizeDashboardUrl("http://localhost:3000/jobs/api/")).toBe(
      "http://localhost:3000/jobs/api",
    );
  });
});

describe("BossbenchClient", () => {
  it("uses bearer token before basic auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new BossbenchClient({
      url: "http://localhost:3000/jobs",
      username: "admin",
      password: "secret",
      token: "token-1",
      fetch: fetchMock,
    });

    await client.get("/overview");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/jobs/api/overview",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-1" }),
      }),
    );
  });

  it("throws actionable API errors", async () => {
    const client = new BossbenchClient({
      url: "http://localhost:3000/jobs",
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Nope" } }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    });

    await expect(client.get("/overview")).rejects.toThrow("Nope");
  });
});

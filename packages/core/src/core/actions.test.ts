import type { PgBoss } from "pg-boss";
import { describe, expect, it, vi } from "vitest";
import { PgBossActionService } from "./actions";

describe("actions", () => {
  it("blocks readonly", async () => {
    const s = new PgBossActionService({} as unknown as PgBoss, true);
    await expect(s.deleteJob("queue", "1")).rejects.toMatchObject({
      code: "READONLY_MODE",
    });
  });
  it("requires boss", async () => {
    const s = new PgBossActionService(undefined, false);
    await expect(s.deleteJob("queue", "1")).rejects.toMatchObject({
      code: "BOSS_INSTANCE_REQUIRED",
    });
  });
  it("calls pg-boss job methods with queue name and id", async () => {
    const boss = {
      retry: vi.fn(),
      cancel: vi.fn(),
      resume: vi.fn(),
      deleteJob: vi.fn(),
    };
    const s = new PgBossActionService(boss as unknown as PgBoss, false);
    await s.retryJob("email", "1");
    await s.cancelJob("email", "2");
    await s.resumeJob("email", "3");
    await s.deleteJob("email", "4");
    expect(boss.retry).toHaveBeenCalledWith("email", "1");
    expect(boss.cancel).toHaveBeenCalledWith("email", "2");
    expect(boss.resume).toHaveBeenCalledWith("email", "3");
    expect(boss.deleteJob).toHaveBeenCalledWith("email", "4");
  });
  it("runs a schedule once now with pg-boss send", async () => {
    const boss = {
      send: vi.fn().mockResolvedValue("job-1"),
    };
    const s = new PgBossActionService(boss as unknown as PgBoss, false);
    const data = { nightly: true };
    const opts = { singletonKey: "billing" };

    await expect(s.runScheduleNow("billing", data, opts)).resolves.toEqual({
      id: "job-1",
    });
    expect(boss.send).toHaveBeenCalledWith("billing", data, opts);
  });
});

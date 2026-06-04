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
  it("blocks queue clean preview when readonly", async () => {
    const s = new PgBossActionService({} as unknown as PgBoss, true, {
      allowQueueClean: true,
    });
    try {
      s.ensureQueueCleanAvailable();
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "READONLY_MODE" });
    }
  });
  it("blocks queue clean preview when boss is missing", async () => {
    const s = new PgBossActionService(undefined, false, {
      allowQueueClean: true,
    });
    try {
      s.ensureQueueCleanAvailable();
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "BOSS_INSTANCE_REQUIRED" });
    }
  });
  it("blocks queue clean preview when disabled", async () => {
    const s = new PgBossActionService({} as unknown as PgBoss, false, {
      allowQueueClean: false,
    });
    try {
      s.ensureQueueCleanAvailable();
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "QUEUE_CLEAN_DISABLED" });
    }
  });
  it("blocks queue clean delete when preview is disabled", async () => {
    const s = new PgBossActionService({} as unknown as PgBoss, false, {
      allowQueueClean: false,
      allowQueueCleanDelete: true,
    });

    expect(() => s.ensureQueueCleanDeleteAvailable()).toThrowError(
      expect.objectContaining({ code: "QUEUE_CLEAN_DISABLED" }),
    );
  });

  it("blocks queue clean delete when destructive flag is disabled", async () => {
    const s = new PgBossActionService({} as unknown as PgBoss, false, {
      allowQueueClean: true,
      allowQueueCleanDelete: false,
    });

    expect(() => s.ensureQueueCleanDeleteAvailable()).toThrowError(
      expect.objectContaining({
        code: "QUEUE_CLEAN_DELETE_DISABLED",
      }),
    );
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

  it("blocks manual enqueue unless enabled", async () => {
    const boss = { send: vi.fn() };
    const s = new PgBossActionService(boss as unknown as PgBoss, false);

    await expect(
      s.enqueueJob("email", { hello: true }, {}),
    ).rejects.toMatchObject({ code: "MANUAL_ENQUEUE_DISABLED" });
    expect(boss.send).not.toHaveBeenCalled();
  });

  it("enqueues manual jobs through pg-boss send when enabled", async () => {
    const boss = {
      getQueue: vi.fn().mockResolvedValue({ name: "email" }),
      send: vi.fn().mockResolvedValue("job-2"),
    };
    const s = new PgBossActionService(boss as unknown as PgBoss, false, {
      allowManualEnqueue: true,
    });

    await expect(
      s.enqueueJob("email", { hello: true }, { priority: 1 }),
    ).resolves.toEqual({ id: "job-2", enqueued: true });
    expect(boss.getQueue).toHaveBeenCalledWith("email");
    expect(boss.send).toHaveBeenCalledWith(
      "email",
      { hello: true },
      { priority: 1 },
    );
  });

  it("reports when pg-boss declines to insert a manual job", async () => {
    const boss = {
      getQueue: vi.fn().mockResolvedValue({ name: "email" }),
      send: vi.fn().mockResolvedValue(null),
    };
    const s = new PgBossActionService(boss as unknown as PgBoss, false, {
      allowManualEnqueue: true,
    });

    await expect(s.enqueueJob("email", {}, {})).resolves.toEqual({
      id: null,
      enqueued: false,
    });
  });

  it("requires the pg-boss queue to exist before manual enqueue", async () => {
    const boss = {
      getQueue: vi.fn().mockResolvedValue(null),
      send: vi.fn(),
    };
    const s = new PgBossActionService(boss as unknown as PgBoss, false, {
      allowManualEnqueue: true,
    });

    await expect(s.enqueueJob("empty", {}, {})).rejects.toMatchObject({
      code: "QUEUE_NOT_FOUND",
    });
    expect(boss.send).not.toHaveBeenCalled();
  });
});

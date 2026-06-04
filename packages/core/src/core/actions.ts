import type { PgBoss } from "pg-boss";

type ActionCapabilities = {
  allowManualEnqueue?: boolean;
  allowQueueClean?: boolean;
  allowQueueCleanDelete?: boolean;
};

export class PgBossActionService {
  constructor(
    private readonly boss: PgBoss | undefined,
    private readonly readonlyMode = false,
    private readonly capabilities: ActionCapabilities = {},
  ) {}
  private ensure() {
    if (this.readonlyMode)
      throw actionError("READONLY_MODE", "Read-only mode enabled");
    if (!this.boss)
      throw actionError(
        "BOSS_INSTANCE_REQUIRED",
        "pg-boss instance required for mutations",
      );
    return this.boss;
  }
  ensureAvailable() {
    this.ensure();
  }
  ensureQueueCleanAvailable() {
    this.ensure();
    if (!this.capabilities.allowQueueClean)
      throw actionError(
        "QUEUE_CLEAN_DISABLED",
        "Queue clean preview is disabled",
      );
  }
  ensureQueueCleanDeleteAvailable() {
    this.ensureQueueCleanAvailable();
    if (!this.capabilities.allowQueueCleanDelete)
      throw actionError(
        "QUEUE_CLEAN_DELETE_DISABLED",
        "Queue clean delete is disabled",
      );
  }
  async retryJob(name: string, id: string) {
    return this.ensure().retry(name, id);
  }
  async cancelJob(name: string, id: string) {
    return this.ensure().cancel(name, id);
  }
  async resumeJob(name: string, id: string) {
    return this.ensure().resume(name, id);
  }
  async deleteJob(name: string, id: string) {
    return this.ensure().deleteJob(name, id);
  }
  async runScheduleNow(name: string, data?: unknown, opts?: unknown) {
    const id = await this.ensure().send(
      name,
      data as object | null | undefined,
      opts as never,
    );
    return { id };
  }
  async enqueueJob(name: string, data?: unknown, opts?: unknown) {
    if (!this.capabilities.allowManualEnqueue)
      throw actionError(
        "MANUAL_ENQUEUE_DISABLED",
        "Manual enqueue is disabled",
      );
    const boss = this.ensure();
    const queue = await boss.getQueue(name);
    if (!queue) throw actionError("QUEUE_NOT_FOUND", "Queue not found");
    const id = await boss.send(
      name,
      data as object | null | undefined,
      opts as never,
    );
    return { id, enqueued: id !== null };
  }
  async createSchedule(name: string, cron: string, data?: unknown) {
    return this.ensure().schedule(
      name,
      cron,
      data as object | null | undefined,
    );
  }
  async deleteSchedule(name: string) {
    return this.ensure().unschedule(name);
  }
  async unschedule(name: string) {
    return this.deleteSchedule(name);
  }
  async schedule(name: string, cron: string, data?: unknown) {
    return this.createSchedule(name, cron, data);
  }
}

export function actionError(code: string, message: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

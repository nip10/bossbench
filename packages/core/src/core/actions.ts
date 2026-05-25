import type { PgBoss } from "pg-boss";

export class PgBossActionService {
  constructor(
    private readonly boss: PgBoss | undefined,
    private readonly readonlyMode = false,
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

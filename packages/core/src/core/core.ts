import { PgBossActionService } from "./actions";
import { normalizeOptions } from "./options";
import { BossbenchRepository } from "./repository";
import type { BossbenchOptions, NormalizedBossbenchOptions } from "./types";

export class BossbenchCore {
  constructor(
    public readonly options: NormalizedBossbenchOptions,
    public readonly repository: BossbenchRepository,
    public readonly actions: PgBossActionService,
  ) {}
  static create(options: BossbenchOptions) {
    const normalized = normalizeOptions(options);
    return new BossbenchCore(
      normalized,
      new BossbenchRepository(
        normalized.db,
        normalized.schema,
        normalized.tags,
      ),
      new PgBossActionService(normalized.boss, normalized.readonly),
    );
  }
  getConfig() {
    return {
      title: this.options.title,
      schema: this.options.schema,
      basePath: this.options.basePath,
      readonly: this.options.readonly,
      tags: this.options.tags,
      hasBoss: !!this.options.boss,
    };
  }
  requiresAuth() {
    return !!this.options.auth?.username && !!this.options.auth?.password;
  }
  validateAuth(username?: string, password?: string) {
    if (!this.requiresAuth()) return this.options.allowUnauthenticated === true;
    return (
      username === this.options.auth?.username &&
      password === this.options.auth?.password
    );
  }
  actionsEnabled() {
    return !!this.options.boss && !this.options.readonly;
  }
}

import { PgBossActionService } from "./actions";
import { evaluateAlertRules, maskContactPoints } from "./alerts";
import { normalizeOptions } from "./options";
import { BossbenchRepository } from "./repository";
import type {
  BossbenchAlertsResponse,
  BossbenchOptions,
  NormalizedBossbenchOptions,
} from "./types";

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
      new PgBossActionService(normalized.boss, normalized.readonly, {
        allowManualEnqueue: normalized.allowManualEnqueue,
        allowQueueClean: normalized.allowQueueClean,
        allowQueueCleanDelete: normalized.allowQueueCleanDelete,
      }),
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
      allowManualEnqueue: this.options.allowManualEnqueue,
      allowQueueClean: this.options.allowQueueClean,
      allowQueueCleanDelete: this.options.allowQueueCleanDelete,
      alerts: {
        enabled: this.options.alerts.enabled,
        ruleCount: this.options.alerts.rules.length,
        contactPointCount: this.options.alerts.contactPoints.length,
      },
    };
  }
  async getAlerts(): Promise<BossbenchAlertsResponse> {
    const alerts = this.options.alerts;
    const snapshot =
      alerts.enabled && alerts.rules.length > 0
        ? await this.repository.getAlertEvaluationSnapshot(alerts.rules)
        : null;

    return {
      enabled: alerts.enabled,
      rules: alerts.rules,
      contactPoints: maskContactPoints(alerts.contactPoints),
      violations: snapshot ? evaluateAlertRules(alerts.rules, snapshot) : [],
      delivery: { enabled: false, available: false },
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

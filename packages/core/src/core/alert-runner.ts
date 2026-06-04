import { resolveContactPointUrl, shouldDeliver } from "./alert-delivery";
import { buildDestinationPayload } from "./alert-destinations";
import type {
  BossbenchAlertContactPoint,
  BossbenchAlertsResponse,
} from "./types";

type AlertRunnerDeps = {
  getAlerts: () => Promise<BossbenchAlertsResponse>;
  contactPoints: BossbenchAlertContactPoint[];
  sendWebhook: (url: string, payload: unknown) => Promise<void>;
  env?: Record<string, string | undefined>;
  now?: () => Date;
};

type AlertRunnerResult = {
  attempted: number;
  failed: number;
  sent: number;
  skipped: number;
};

export class AlertRunner {
  private readonly lastSentAt = new Map<string, Date>();

  constructor(private readonly deps: AlertRunnerDeps) {}

  async runOnce(): Promise<AlertRunnerResult> {
    const alerts = await this.deps.getAlerts();
    const now = this.deps.now?.() ?? new Date();
    const result: AlertRunnerResult = {
      attempted: 0,
      failed: 0,
      sent: 0,
      skipped: 0,
    };

    if (!alerts.enabled) return result;

    for (const violation of alerts.violations) {
      const rule = alerts.rules.find(
        (candidate) => candidate.id === violation.ruleId,
      );
      const contactPoints = this.contactPointsFor(rule?.contactPointIds);

      for (const contactPoint of contactPoints) {
        result.attempted += 1;
        const dedupeKey = `${violation.fingerprint}:${contactPoint.id}`;
        if (
          !shouldDeliver(
            now,
            this.lastSentAt.get(dedupeKey),
            rule?.cooldownMinutes ?? 0,
          )
        ) {
          result.skipped += 1;
          continue;
        }

        const url = resolveContactPointUrl(contactPoint, this.deps.env ?? {});
        if (!url) {
          result.skipped += 1;
          continue;
        }

        try {
          await this.deps.sendWebhook(
            url,
            buildDestinationPayload(contactPoint.type, violation),
          );
        } catch {
          result.failed += 1;
          continue;
        }
        this.lastSentAt.set(dedupeKey, now);
        result.sent += 1;
      }
    }

    return result;
  }

  private contactPointsFor(contactPointIds: string[] | undefined) {
    if (!contactPointIds?.length) return this.deps.contactPoints;
    const allowed = new Set(contactPointIds);
    return this.deps.contactPoints.filter((contactPoint) =>
      allowed.has(contactPoint.id),
    );
  }
}

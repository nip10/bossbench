import type {
  BossbenchAlertContactPoint,
  BossbenchAlertViolation,
} from "./types";

export function shouldDeliver(
  now: Date,
  lastSentAt: Date | undefined,
  cooldownMinutes = 0,
) {
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= cooldownMinutes * 60_000;
}

export function resolveContactPointUrl(
  contactPoint: BossbenchAlertContactPoint,
  env: Record<string, string | undefined>,
) {
  return (
    contactPoint.url ??
    (contactPoint.urlEnv ? env[contactPoint.urlEnv] : undefined)
  );
}

export function buildWebhookPayload(violation: BossbenchAlertViolation) {
  return {
    ruleId: violation.ruleId,
    ruleName: violation.ruleName,
    type: violation.type,
    severity: violation.severity,
    queue: violation.queue,
    current: violation.current,
    threshold: violation.threshold,
    observedAt: violation.observedAt,
    fingerprint: violation.fingerprint,
  };
}

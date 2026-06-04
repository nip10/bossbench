import type {
  AlertEvaluationSnapshot,
  BossbenchAlertContactPoint,
  BossbenchAlertRule,
  BossbenchAlertViolation,
} from "./types";

export function evaluateAlertRules(
  rules: BossbenchAlertRule[],
  snapshot: AlertEvaluationSnapshot,
  observedAt = new Date(),
): BossbenchAlertViolation[] {
  const observed = observedAt.toISOString();

  return rules.flatMap((rule) => {
    const current = currentValue(rule, snapshot);
    if (current < rule.threshold) return [];

    const queue = rule.queue ?? null;
    return [
      {
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        severity: rule.severity ?? "warning",
        queue,
        threshold: rule.threshold,
        current,
        windowMinutes: rule.windowMinutes ?? null,
        observedAt: observed,
        fingerprint: [rule.id, rule.type, queue ?? "all"].join(":"),
      },
    ];
  });
}

export function maskContactPoints(contactPoints: BossbenchAlertContactPoint[]) {
  return contactPoints.map((contactPoint) => ({
    id: contactPoint.id,
    name: contactPoint.name,
    type: contactPoint.type,
    configured: !!(contactPoint.url || contactPoint.urlEnv),
  }));
}

function currentValue(
  rule: BossbenchAlertRule,
  snapshot: AlertEvaluationSnapshot,
) {
  const ruleValue = snapshot.ruleValues?.[rule.id];
  if (ruleValue !== undefined) return ruleValue;

  const queue = rule.queue
    ? snapshot.overview.queues.find((item) => item.name === rule.queue)
    : null;
  const queueMetric = rule.queue
    ? snapshot.metrics.queues.find((item) => item.name === rule.queue)
    : null;

  switch (rule.type) {
    case "failed_count":
      return rule.queue
        ? (queue?.failed ?? 0)
        : snapshot.overview.totals.failed;
    case "dead_letter_count":
      return snapshot.overview.deadLetter;
    case "retry_backlog_count":
      return rule.queue ? (queue?.retry ?? 0) : snapshot.overview.totals.retry;
    case "oldest_created_age":
      return rule.queue
        ? (snapshot.oldestCreatedAges?.[rule.queue] ?? 0)
        : Math.max(0, ...Object.values(snapshot.oldestCreatedAges ?? {}));
    case "avg_wait_ms":
      return rule.queue
        ? (queueMetric?.avgWaitMs ?? 0)
        : (snapshot.metrics.summary.avgWaitMs ?? 0);
    case "avg_duration_ms":
      return rule.queue
        ? (queueMetric?.avgDurationMs ?? 0)
        : (snapshot.metrics.summary.avgDurationMs ?? 0);
    case "warning_count":
      return snapshot.overview.warnings;
  }
}

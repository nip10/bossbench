import { assertSafeIdentifier } from "./identifiers";
import type { BossbenchOptions, NormalizedBossbenchOptions } from "./types";
export function normalizeOptions(
  options: BossbenchOptions,
): NormalizedBossbenchOptions {
  if (!options.db && !options.boss)
    throw new Error("Bossbench requires a db connection or a pg-boss instance");
  const auth = normalizeAuth(options.auth);
  if (!auth && !options.allowUnauthenticated)
    throw new Error(
      "Bossbench requires non-empty auth or allowUnauthenticated: true",
    );
  const schema = assertSafeIdentifier(options.schema ?? "pgboss");
  const { auth: _auth, ...rest } = options;
  return {
    ...rest,
    ...(auth ? { auth } : {}),
    schema,
    title: options.title ?? "Bossbench",
    readonly: options.readonly ?? !auth,
    allowManualEnqueue: options.allowManualEnqueue ?? false,
    allowQueueClean: options.allowQueueClean ?? false,
    allowQueueCleanDelete: options.allowQueueCleanDelete ?? false,
    alerts: normalizeAlerts(options.alerts),
    tags: options.tags ?? [],
    basePath: options.basePath ?? "/",
  };
}

function normalizeAuth(auth: BossbenchOptions["auth"]) {
  if (!auth?.username || !auth.password) return undefined;
  return auth;
}

function normalizeAlerts(
  alerts: BossbenchOptions["alerts"],
): NormalizedBossbenchOptions["alerts"] {
  const normalized = {
    enabled: alerts?.enabled ?? false,
    rules: alerts?.rules ?? [],
    contactPoints: alerts?.contactPoints ?? [],
  };

  for (const rule of normalized.rules) {
    if (!rule.id.trim()) throw new Error("Alert rule id is required");
    if (!rule.name.trim()) throw new Error("Alert rule name is required");
    if (rule.threshold <= 0)
      throw new Error("Alert rule threshold must be greater than 0");
    if (rule.windowMinutes !== undefined && rule.windowMinutes <= 0)
      throw new Error("Alert rule windowMinutes must be greater than 0");
    if (rule.cooldownMinutes !== undefined && rule.cooldownMinutes < 0)
      throw new Error("Alert rule cooldownMinutes must be non-negative");
    if (rule.type === "oldest_created_age" && rule.windowMinutes !== undefined)
      throw new Error(
        "Alert rule type oldest_created_age does not support windows",
      );
    if (
      rule.queue &&
      (rule.type === "warning_count" || rule.type === "dead_letter_count")
    )
      throw new Error(
        `Alert rule type ${rule.type} does not support queue filters`,
      );
  }

  for (const contactPoint of normalized.contactPoints) {
    if (!contactPoint.id.trim())
      throw new Error("Alert contact point id is required");
    if (!contactPoint.name.trim())
      throw new Error("Alert contact point name is required");
    if (!contactPoint.url && !contactPoint.urlEnv)
      throw new Error("Alert contact point requires url or urlEnv");
  }

  ensureUnique(
    normalized.rules.map((rule) => rule.id),
    "Alert rule ids must be unique",
  );
  ensureUnique(
    normalized.contactPoints.map((contactPoint) => contactPoint.id),
    "Alert contact point ids must be unique",
  );

  const contactPointIds = new Set(
    normalized.contactPoints.map((contactPoint) => contactPoint.id),
  );
  for (const rule of normalized.rules) {
    for (const contactPointId of rule.contactPointIds ?? []) {
      if (!contactPointIds.has(contactPointId))
        throw new Error(
          `Alert rule ${rule.id} references unknown contact point ${contactPointId}`,
        );
    }
  }

  return normalized;
}

function ensureUnique(values: string[], message: string) {
  if (new Set(values).size !== values.length) throw new Error(message);
}

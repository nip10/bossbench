# Upstream alerting and docs parity design

Date: 2026-06-04

Issues: [#71](https://github.com/nip10/bossbench/issues/71), [#72](https://github.com/nip10/bossbench/issues/72), [#73](https://github.com/nip10/bossbench/issues/73), [#74](https://github.com/nip10/bossbench/issues/74), [#75](https://github.com/nip10/bossbench/issues/75)

Upstream range: [`pontusab/workbench@4937b37..aefd22c`](https://github.com/pontusab/workbench/compare/4937b37...aefd22c11cbebc26c619df201641995e661af624)

## Context

Workbench added self-hosted alerting, Slack/webhook/Discord alert destinations, a dashboard Alerts surface, a Fumadocs-powered docs hub, and minor marketing cleanup after Bossbench's last upstream audit.

Bossbench should port the product intent, not the BullMQ implementation. Bossbench is pg-boss/Postgres-native, read-only by default, and often embedded in application processes that may run more than one replica. Alerting therefore needs conservative defaults around polling, writes, secret handling, and duplicate delivery.

## Goals

- Track the new upstream Workbench changes in the parity tracker and GitHub issues.
- Add pg-boss-native alerting as an incremental Bossbench capability.
- Support webhook-first notification delivery, with Slack and Discord as formatting adapters.
- Add or expand user-facing docs for alerting, framework setup, deployment, and environment/auth guidance.
- Apply reasonable marketing/discoverability cleanup where it improves Bossbench positioning.

## Non-goals

- Do not copy Workbench's BullMQ `QueueEvents` architecture.
- Do not add BullMQ-only rule types such as stalled, paused, drained, or flow/DAG events.
- Do not require a `PgBoss` mutation instance for read-only alert evaluation.
- Do not store raw webhook secrets through dashboard CRUD in the first version.
- Do not create or mutate pg-boss tables for alert history by default.
- Do not run delivery from browser refreshes or request handlers.

## Approach

Use a staged implementation. Create issues for the full upstream delta, then implement the alerting foundation before adding delivery and docs polish.

### Stage 1: audit and tickets

- Update `docs/workbench-parity-tracker.md` with the `4937b37..aefd22c` audit row.
- Add parity rows for alerting, alert destinations, and docs hub status.
- Create GitHub issues for:
  1. pg-boss-native alert evaluator and Alerts page;
  2. alert delivery runner with webhook destinations;
  3. Slack and Discord alert formatting;
  4. docs hub or expanded docs content;
  5. marketing/discoverability cleanup.

### Stage 2: alerting MVP

Alerting begins as read-only evaluation plus dashboard/API visibility.

Add option shape along these lines:

```ts
type BossbenchAlertRule = {
  id: string;
  name: string;
  type:
    | "failed_count"
    | "dead_letter_count"
    | "retry_backlog_count"
    | "oldest_created_age"
    | "avg_wait_ms"
    | "avg_duration_ms"
    | "warning_count";
  queue?: string;
  windowMinutes?: number;
  threshold: number;
  severity?: "info" | "warning" | "critical";
  cooldownMinutes?: number;
  contactPointIds?: string[];
};

type BossbenchAlertsOptions = {
  enabled?: boolean;
  rules?: BossbenchAlertRule[];
};
```

The first implementation should expose current violations and configured rules only. It should not send notifications.

Suggested API shape:

- `GET /api/alerts` returns enabled state, rules, contact point summaries, current violations, and delivery capability state.
- `GET /api/alerts/violations` may be split out if the payload becomes large.

Suggested UI shape:

- Add `/alerts` route and sidebar/command-palette entry.
- Show setup empty state when alerting is disabled or no rules exist.
- Show current violations with severity, queue, threshold, current value, and observed window.
- Show configured rules and masked contact point summaries.

### Stage 3: delivery runner

Delivery must be opt-in and server-side only.

Add contact point config that references secrets by environment/config, not editable dashboard fields:

```ts
type BossbenchAlertContactPoint = {
  id: string;
  name: string;
  type: "webhook" | "slack" | "discord";
  url?: string;
  urlEnv?: string;
};
```

Add runner options:

```ts
type BossbenchAlertRunnerOptions = {
  enabled?: boolean;
  pollIntervalMs?: number;
  singleRunner?: boolean;
  advisoryLockKey?: number;
};
```

Delivery requirements:

- Deduplicate by alert fingerprint.
- Respect per-rule cooldowns.
- Use timeouts and bounded retries for outbound webhooks.
- Prefer one active evaluator per deployment. Use Postgres advisory lock when possible, or document `singleRunner` deployment mode.
- Start with in-memory dedupe/history. Persistent history should be a later optional Bossbench-owned table, not pg-boss schema mutation.

### Stage 4: Slack and Discord formatting

Slack and Discord should be adapters over generic webhook delivery.

- Slack: send a Block Kit-compatible or simple webhook payload with rule, severity, queue, current value, threshold, and Bossbench path.
- Discord: send an embed payload with the same semantic fields.
- Keep destination-specific code small and testable.
- Mask contact point URLs in API/UI output.

### Stage 5: docs and marketing

Bossbench should improve docs without blindly copying Workbench's docs stack.

Two acceptable paths:

1. expand existing README/package docs plus marketing app pages;
2. add a `/docs` section if the current site needs structured navigation.

Initial docs should cover:

- quick start;
- auth and read-only defaults;
- environment variables;
- framework adapters;
- standalone Docker deployment;
- alerting configuration and delivery safety;
- multi-instance alert runner guidance.

Marketing cleanup should emphasize Bossbench as the pg-boss/Postgres-native operational dashboard rather than a Bull Board clone.

## Data flow

1. User configures `alerts` in Bossbench options.
2. Repository reads pg-boss job, warning, dead-letter, and metrics data from Postgres.
3. Alert evaluator converts rules plus current data into violations.
4. API returns rule/config summaries and current violations to the dashboard.
5. Optional runner polls the evaluator, deduplicates violations, and delivers to contact points.
6. UI shows current violations, rules, contact point summaries, and delivery status.

## Error handling and safety

- Invalid alert rules should fail fast during option normalization where possible.
- Missing contact point secrets should mark delivery unavailable without breaking read-only dashboard use.
- Delivery failures should be bounded and visible in API/UI state when runner support exists.
- Alert queries must be time-windowed and queue-filtered where possible to avoid expensive scans.
- Multi-instance deployments must not send duplicate notifications by default when advisory locking is enabled.

## Testing

- Unit-test option normalization and invalid alert configs.
- Unit-test evaluator rules against representative repository results.
- Unit-test webhook/Slack/Discord payload formatting.
- Unit-test dedupe/cooldown behavior.
- Add API handler tests for alert payloads and disabled/setup states.
- Add UI tests where existing coverage patterns make sense.
- Add integration tests only after alert queries stabilize.

## Open decisions

- Whether alert history should remain in memory for v1 or gain an optional Bossbench-owned table.
- Whether the first docs pass should be a full `/docs` site or expanded static/README docs.
- Whether alert delivery should live inside `@bossbench/core` only or be split later into a runner package.
- Whether alerting should be enabled in the standalone app through environment variables in the first delivery release.

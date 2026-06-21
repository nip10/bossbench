import type {
  MetricsResponse,
  OverviewStats,
  QueueMetricSummary,
} from "../../core/types";
import { formatDurationMs, formatPercent } from "./metrics";
import { formatRelativeTime } from "./utils";

export function dashboardShellHeightDeclaration() {
  return { height: "100%", minHeight: "100vh" };
}

export function sidebarQueueListLimit() {
  return 8;
}

export type DashboardAttentionSignal = {
  tone: "critical" | "warning" | "info";
  title: string;
  value: string;
  detail: string;
  href: string;
};

export type OverviewLiveStatus = {
  tone: "success" | "info" | "warning";
  title: string;
  detail: string;
  meta: string;
};

export type OverviewQueueHealthTone =
  | "critical"
  | "warning"
  | "info"
  | "neutral";

export type OverviewQueueHealthCard = {
  name: string;
  href: string;
  tone: OverviewQueueHealthTone;
  label: string;
  detail: string;
  created: string;
  retry: string;
  active: string;
  failed: string;
  errorRate: string;
  avgWait: string;
  avgDuration: string;
};

function hasUsableTimestamp(value: string | number | null | undefined) {
  return !(
    value === null ||
    value === undefined ||
    (typeof value === "number" && value <= 0)
  );
}

export function buildOverviewAttentionSignals(
  overview: OverviewStats,
  metrics?: MetricsResponse | null,
) {
  const signals: DashboardAttentionSignal[] = [];

  if (overview.deadLetter > 0) {
    signals.push({
      tone: "critical",
      title: "Dead letter",
      value: overview.deadLetter.toString(),
      detail:
        overview.deadLetter === 1
          ? "Job needs inspection"
          : "Jobs need inspection",
      href: "/dead-letter",
    });
  }

  if (overview.warnings > 0) {
    signals.push({
      tone: "warning",
      title: "Warnings",
      value: overview.warnings.toString(),
      detail: "Warnings need review",
      href: "/warnings",
    });
  }

  if (overview.totals.failed > 0) {
    signals.push({
      tone: "warning",
      title: "Failed jobs",
      value: overview.totals.failed.toString(),
      detail: `${overview.totals.failed.toLocaleString()} failed across the dashboard`,
      href: "/metrics",
    });
  }

  const failingQueue = pickFailingQueue(metrics?.queues ?? []);
  if (failingQueue) {
    signals.push({
      tone:
        failingQueue.failed >= 5 || failingQueue.errorRate >= 0.1
          ? "critical"
          : "warning",
      title: "Failing queue",
      value: failingQueue.name,
      detail: `${failingQueue.failed.toLocaleString()} failed • ${formatPercent(failingQueue.errorRate)} error rate`,
      href: `/queues/${encodeURIComponent(failingQueue.name)}`,
    });
  }

  const slowQueue = pickSlowQueue(metrics?.queues ?? []);
  if (slowQueue) {
    signals.push({
      tone: "info",
      title: "Slowest queue",
      value: slowQueue.name,
      detail: `Avg wait ${formatDurationMs(slowQueue.avgWaitMs)} • avg duration ${formatDurationMs(slowQueue.avgDurationMs)}`,
      href: `/queues/${encodeURIComponent(slowQueue.name)}`,
    });
  }

  return signals.slice(0, 4);
}

export function buildOverviewLiveStatus(input: {
  overviewUpdatedAt: string | number | null | undefined;
  metricsUpdatedAt: string | number | null | undefined;
  metricsLoading: boolean;
  metricsError: string | null | undefined;
  hasMetrics: boolean;
}): OverviewLiveStatus {
  const overviewSync = hasUsableTimestamp(input.overviewUpdatedAt)
    ? `Overview synced ${formatRelativeTime(input.overviewUpdatedAt)}.`
    : "Overview live.";
  const metricsSync = hasUsableTimestamp(input.metricsUpdatedAt)
    ? `Health metrics synced ${formatRelativeTime(input.metricsUpdatedAt)}.`
    : null;

  if (input.metricsError) {
    const metricsSuffix = input.metricsLoading
      ? "Health metrics are loading."
      : "Health metrics are unavailable.";

    return {
      tone: "warning",
      title: "Live command center",
      detail: metricsSync
        ? `${overviewSync} ${metricsSync}`
        : `${overviewSync} ${metricsSuffix}`,
      meta: input.hasMetrics
        ? "Showing cached health metrics"
        : input.metricsLoading
          ? "Loading health metrics"
          : "Health metrics unavailable",
    };
  }

  if (input.metricsLoading && !input.hasMetrics) {
    return {
      tone: "info",
      title: "Live command center",
      detail: metricsSync
        ? `${overviewSync} ${metricsSync}`
        : `${overviewSync} Health metrics are loading.`,
      meta: "Loading health metrics",
    };
  }

  if (!input.hasMetrics) {
    return {
      tone: "info",
      title: "Live command center",
      detail: overviewSync,
      meta: "Queue counts only",
    };
  }

  return {
    tone: "success",
    title: "Live command center",
    detail: metricsSync ? `${overviewSync} ${metricsSync}` : overviewSync,
    meta: "Metrics current",
  };
}

export function buildOverviewQueueHealthCards(
  queues: OverviewStats["queues"],
  metricsQueues: QueueMetricSummary[] | null | undefined,
  limit = 6,
): OverviewQueueHealthCard[] {
  if (!queues.length) return [];

  const metricsByName = new Map(
    (metricsQueues ?? []).map((queue) => [queue.name, queue] as const),
  );

  return [...queues]
    .sort(
      (left, right) =>
        queueHealthRank(left, metricsByName.get(left.name)) -
          queueHealthRank(right, metricsByName.get(right.name)) ||
        left.name.localeCompare(right.name),
    )
    .map((queue) => {
      const metrics = metricsByName.get(queue.name);
      const status = queueHealthStatus(queue, metrics);
      return {
        name: queue.name,
        href: `/queues/${encodeURIComponent(queue.name)}`,
        tone: status.tone,
        label: status.label,
        detail: status.detail,
        created: queue.created.toLocaleString(),
        retry: queue.retry.toLocaleString(),
        active: queue.active.toLocaleString(),
        failed: queue.failed.toLocaleString(),
        errorRate: formatPercent(metrics?.errorRate),
        avgWait: formatDurationMs(metrics?.avgWaitMs),
        avgDuration: formatDurationMs(metrics?.avgDurationMs),
      } satisfies OverviewQueueHealthCard;
    })
    .slice(0, limit);
}

export function dashboardRefreshCue(updatedAt: number | null | undefined) {
  if (updatedAt === null || updatedAt === undefined) return "Live";
  return `Live • synced ${formatRelativeTime(updatedAt)}`;
}

function pickFailingQueue(queues: QueueMetricSummary[]) {
  return [...queues]
    .filter((queue) => queue.failed > 0)
    .sort(
      (left, right) =>
        right.failed - left.failed ||
        right.errorRate - left.errorRate ||
        left.name.localeCompare(right.name),
    )[0];
}

function pickSlowQueue(queues: QueueMetricSummary[]) {
  return [...queues]
    .filter((queue) => queue.avgDurationMs !== null || queue.avgWaitMs !== null)
    .sort((left, right) => {
      const rightScore = Math.max(
        right.avgWaitMs ?? 0,
        right.avgDurationMs ?? 0,
      );
      const leftScore = Math.max(left.avgWaitMs ?? 0, left.avgDurationMs ?? 0);
      return rightScore - leftScore || left.name.localeCompare(right.name);
    })[0];
}

function queueHealthStatus(
  queue: OverviewStats["queues"][number],
  metrics: QueueMetricSummary | undefined,
): { tone: OverviewQueueHealthTone; label: string; detail: string } {
  if (
    queue.failed > 0 ||
    (metrics?.failed ?? 0) > 0 ||
    (metrics?.errorRate ?? 0) >= 0.1
  ) {
    return {
      tone: "critical",
      label: "Failing",
      detail: `${queue.failed.toLocaleString()} failed • ${formatPercent(metrics?.errorRate)} error rate`,
    };
  }

  if (queue.retry > 0) {
    return {
      tone: "warning",
      label: "Retry backlog",
      detail: `${queue.retry.toLocaleString()} retrying • ${queue.active.toLocaleString()} active`,
    };
  }

  if (queue.created > 0 || queue.active > 0) {
    return {
      tone: "info",
      label: "Busy",
      detail: `${queue.created.toLocaleString()} created • ${queue.active.toLocaleString()} active`,
    };
  }

  const slowMs = Math.max(metrics?.avgWaitMs ?? 0, metrics?.avgDurationMs ?? 0);
  if (slowMs >= 30_000) {
    return {
      tone: "info",
      label: "Slow",
      detail: `Avg wait ${formatDurationMs(metrics?.avgWaitMs)} • avg duration ${formatDurationMs(metrics?.avgDurationMs)}`,
    };
  }

  return {
    tone: "neutral",
    label: "Quiet",
    detail: "No recent queue activity",
  };
}

function queueHealthRank(
  queue: OverviewStats["queues"][number],
  metrics: QueueMetricSummary | undefined,
) {
  if (
    queue.failed > 0 ||
    (metrics?.failed ?? 0) > 0 ||
    (metrics?.errorRate ?? 0) >= 0.1
  )
    return 0;
  if (queue.retry > 0) return 1;
  if (queue.created > 0 || queue.active > 0) return 2;
  if (Math.max(metrics?.avgWaitMs ?? 0, metrics?.avgDurationMs ?? 0) >= 30_000)
    return 3;
  return 4;
}

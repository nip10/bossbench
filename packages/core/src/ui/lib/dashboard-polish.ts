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

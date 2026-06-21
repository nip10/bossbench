import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CircleSlash2,
  Clock3,
  Database,
  Inbox,
  LoaderCircle,
  Percent,
  SearchX,
  SquareActivity,
} from "lucide-react";
import {
  isValidElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ActivityPoint,
  BossbenchAlertRule,
  BossbenchAlertRuleType,
  BossbenchAlertViolation,
  BossbenchJobState,
  BulkJobActionResult,
  JobDetail,
  JobSummary,
  MetricPoint,
  MetricsResponse,
  OverviewStats,
  QueueCleanDeleteResult,
  QueueCleanPreviewResult,
  QueueInfo,
  QueueMetricSummary,
  ScheduleInfo,
  WarningInfo,
} from "../core/types";
import { SummaryCard } from "./components/metrics/summary-card";
import { EmptyState } from "./components/shared/empty-state";
import { JsonViewer } from "./components/shared/json-viewer";
import { RelativeTime } from "./components/shared/relative-time";
import { SmartSearch } from "./components/shared/smart-search";
import {
  createSort,
  parseSort,
  SortableHeader,
} from "./components/shared/sortable-header";
import { StatusBadge } from "./components/shared/status-badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { api } from "./lib/api";
import { buildOverviewAttentionSignals } from "./lib/dashboard-polish";
import { parseEnqueuePayloadInput } from "./lib/enqueue";
import {
  futureJobsDefaultSort,
  futureJobsEmptyDescription,
  futureJobsSubtitle,
} from "./lib/future-jobs";
import {
  queryKeys,
  queryPrefixes,
  useActivity,
  useAlerts,
  useConfig,
  useDeadLetter,
  useFutureJobs,
  useJob,
  useJobs,
  useMetrics,
  useOverview,
  useQueue,
  useQueues,
  useSchedules,
  useWarnings,
} from "./lib/hooks";
import {
  buildJobExport,
  buildJobOperationalContext,
  buildJobTimeline,
  jobExportFilename,
  stringifyForClipboard,
} from "./lib/job-detail";
import { failureSnippetForJobSummary } from "./lib/job-snippet";
import { formatDurationMs, formatPercent, scaleValue } from "./lib/metrics";
import { parseScheduleDataInput } from "./lib/schedules";
import { truncate } from "./lib/utils";
import { useDashboardSearch } from "./router";

function Section({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="filters">{actions}</div>
      </div>
      {children}
    </section>
  );
}

function Table({
  columns,
  rows,
  columnClassNames,
  wrapperClassName,
  tableClassName,
}: {
  columns: ReactNode[];
  rows: ReactNode[][];
  columnClassNames?: Array<string | undefined>;
  wrapperClassName?: string;
  tableClassName?: string;
}) {
  const table = (
    <table className={tableClassName ? `table ${tableClassName}` : "table"}>
      <thead>
        <tr>
          {columns.map((column, columnIndex) => (
            <th
              key={nodeKey(column)}
              className={columnClassNames?.[columnIndex]}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {row.map((cell, cellIndex) => (
              <td
                key={cellKey(row, cell, cellIndex)}
                className={columnClassNames?.[cellIndex]}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (!wrapperClassName) return table;

  return <div className={wrapperClassName}>{table}</div>;
}

function rowKey(row: ReactNode[]) {
  for (const cell of row) {
    if (isValidElement(cell) && cell.key !== null && cell.key !== undefined) {
      return String(cell.key);
    }
    if (typeof cell === "string" || typeof cell === "number")
      return String(cell);
  }
  return row.length.toString();
}

function isDurationAlertRule(type: BossbenchAlertRuleType) {
  return type === "avg_wait_ms" || type === "avg_duration_ms";
}

function formatAlertValue(type: BossbenchAlertRuleType, value: number) {
  if (type === "oldest_created_age") return formatSeconds(value);
  return isDurationAlertRule(type)
    ? formatDurationMs(value)
    : value.toLocaleString();
}

function formatSeconds(value: number) {
  if (value < 60) return `${value.toLocaleString()}s`;
  if (value < 3600) return `${Math.round(value / 60).toLocaleString()}m`;
  return `${(value / 3600).toFixed(1)}h`;
}

function alertScope(rule: BossbenchAlertRule) {
  return rule.queue ? rule.queue : "All queues";
}

function alertDeliveryStatus(delivery: {
  enabled: boolean;
  available: boolean;
}) {
  if (!delivery.available) return "Unavailable";
  return delivery.enabled ? "Enabled" : "Disabled";
}

function nodeKey(node: ReactNode) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isValidElement(node) && node.key !== null && node.key !== undefined) {
    return String(node.key);
  }
  return "node";
}

function cellKey(row: ReactNode[], cell: ReactNode, cellIndex: number) {
  return `${rowKey(row)}-${nodeKey(cell)}-${cellIndex}`;
}

type BulkActionState =
  | {
      status: "running";
      label: string;
    }
  | {
      status: "complete" | "error";
      label: string;
      message: string;
    }
  | null;

type JobDetailTab = "summary" | "payload" | "output" | "timeline" | "raw";

type JobFeedbackState = {
  kind: "running" | "success" | "error";
  message: string;
} | null;

type QueueCleanPreviewState = {
  status: "running" | "success" | "error";
  message: string;
  result?: QueueCleanPreviewResult;
} | null;

type QueueCleanDeleteState = {
  status: "running" | "success" | "error";
  message: string;
  result?: QueueCleanDeleteResult;
} | null;

function summarizeBulkFailures(
  failed: BulkJobActionResult["failed"],
  limit = 3,
) {
  if (!failed.length) return "";

  const preview = failed
    .slice(0, limit)
    .map(({ id, code }) => `${id} (${code})`)
    .join(", ");
  const remaining = failed.length - limit;

  return `Failed: ${preview}${remaining > 0 ? `, +${remaining} more` : ""}`;
}

function queueCleanDeleteWarningCopy(
  state: Extract<BossbenchJobState, "completed" | "failed">,
) {
  if (state === "failed") {
    return "This permanently deletes failed pg-boss job rows from Postgres; deleted jobs disappear from Dead Letter, metrics, timelines, and cannot be retried.";
  }

  return "This permanently deletes completed pg-boss job rows from Postgres; deleted jobs disappear from historical job lists and metrics.";
}

async function invalidateBulkActionQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryPrefixes.jobs }),
    queryClient.invalidateQueries({ queryKey: queryPrefixes.job }),
    queryClient.invalidateQueries({ queryKey: queryPrefixes.queues }),
    queryClient.invalidateQueries({ queryKey: queryPrefixes.queue }),
    queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
    queryClient.invalidateQueries({ queryKey: queryKeys.deadLetter }),
    queryClient.invalidateQueries({ queryKey: queryKeys.metrics }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity }),
  ]);
}

async function invalidateJobActionQueries(
  queryClient: QueryClient,
  jobId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.job(jobId) }),
    queryClient.invalidateQueries({ queryKey: queryPrefixes.jobs }),
    queryClient.invalidateQueries({ queryKey: queryPrefixes.queues }),
    queryClient.invalidateQueries({ queryKey: queryPrefixes.queue }),
    queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
    queryClient.invalidateQueries({ queryKey: queryKeys.deadLetter }),
    queryClient.invalidateQueries({ queryKey: queryKeys.metrics }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity }),
  ]);
}

async function invalidateQueueActionQueries(
  queryClient: QueryClient,
  queueName: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.queue(queueName) }),
    queryClient.invalidateQueries({ queryKey: queryPrefixes.queue }),
    queryClient.invalidateQueries({ queryKey: queryPrefixes.jobs }),
    queryClient.invalidateQueries({ queryKey: queryPrefixes.queues }),
    queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
    queryClient.invalidateQueries({ queryKey: queryKeys.metrics }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity }),
  ]);
}

export function OverviewPage() {
  const { data, isLoading, error } = useOverview();
  const {
    data: metricsData,
    isLoading: metricsLoading,
    error: metricsError,
  } = useMetrics();
  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading overview…" />;
  if (error)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Failed to load overview"
        description={error.message}
      />
    );
  if (!data) return null;

  const overview = data as OverviewStats;
  const summary = metricsData?.summary;
  const queueMetrics = metricsData?.queues;
  const totalJobs = Object.values(overview.totals).reduce(
    (sum: number, value: number) => sum + value,
    0,
  );
  const attentionSignals = buildOverviewAttentionSignals(overview, metricsData);
  const slowestQueues = [...(queueMetrics ?? [])].sort(
    (left, right) =>
      sortNullableDesc(left.avgDurationMs, right.avgDurationMs) ||
      left.name.localeCompare(right.name),
  );
  const failingQueues = [...(queueMetrics ?? [])].sort((left, right) => {
    if (right.failed !== left.failed) return right.failed - left.failed;
    if (right.errorRate !== left.errorRate)
      return right.errorRate - left.errorRate;
    return left.name.localeCompare(right.name);
  });
  const healthNotice =
    metricsLoading && !metricsData
      ? "Loading health signals…"
      : metricsError
        ? `Health signals unavailable${metricsData ? " (showing cached data)" : ""}: ${metricsError.message}`
        : null;

  return (
    <div className="section">
      <div className="stats-grid">
        <SummaryCard
          title="Total Jobs"
          value={totalJobs.toLocaleString()}
          subtitle="Across all states"
          icon={Database}
        />
        <SummaryCard
          title="Dead Letter"
          value={overview.deadLetter.toLocaleString()}
          subtitle="Needs attention"
          icon={CircleSlash2}
        />
        <SummaryCard
          title="Warnings"
          value={overview.warnings.toLocaleString()}
          subtitle="Schema or runtime"
          icon={Bell}
        />
        <SummaryCard
          title="Queues"
          value={overview.queues.length.toLocaleString()}
          subtitle="Configured queues"
          icon={Inbox}
        />
      </div>
      <Section title="Attention" subtitle="Signals that need review right now">
        {attentionSignals.length ? (
          <div className="attention-grid">
            {attentionSignals.map((signal) => (
              <Link
                key={`${signal.title}-${signal.value}`}
                to={signal.href as never}
                className={`attention-card attention-${signal.tone}`}
              >
                <div className="attention-card-kicker">{signal.title}</div>
                <div className="attention-card-value">{signal.value}</div>
                <div className="attention-card-detail">{signal.detail}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="banner compact">
            Command center clear: no urgent signals.
          </div>
        )}
      </Section>
      <Section
        title="Health signals"
        subtitle="Metrics-driven throughput, latency, and queue health"
      >
        {healthNotice ? (
          <div className="banner compact">{healthNotice}</div>
        ) : null}
        <div className="stats-grid">
          <SummaryCard
            title="Throughput"
            value={summary ? summary.throughputPerHour.toFixed(1) : "—"}
            subtitle="jobs/hour"
            icon={BarChart3}
            className="metrics-summary-card"
          />
          <SummaryCard
            title="Error Rate"
            value={formatPercent(summary?.errorRate)}
            subtitle={
              summary
                ? `${summary.totalFailed.toLocaleString()} failed`
                : "Failed jobs"
            }
            icon={Percent}
            className="metrics-summary-card"
          />
          <SummaryCard
            title="Avg Wait"
            value={formatDurationMs(summary?.avgWaitMs)}
            subtitle="queued before start"
            icon={Clock3}
            className="metrics-summary-card"
          />
          <SummaryCard
            title="Avg Duration"
            value={formatDurationMs(summary?.avgDurationMs)}
            subtitle="pg-boss execution time"
            icon={Clock3}
            className="metrics-summary-card"
          />
        </div>
      </Section>
      <Section title="Queues" subtitle="Current queue state counts">
        <Table
          columns={[
            "Queue",
            "Total",
            "Created",
            "Retry",
            "Active",
            "Completed",
            "Cancelled",
            "Failed",
          ]}
          rows={(overview.queues as QueueInfo[]).map((queue) => [
            queue.name,
            queue.total,
            queue.created,
            queue.retry,
            queue.active,
            queue.completed,
            queue.cancelled,
            queue.failed,
          ])}
        />
      </Section>
      <div className="metrics-layout">
        <Section title="Slowest queues" subtitle="Sorted by average duration">
          {slowestQueues.length ? (
            <Table
              wrapperClassName="jobs-table-scroll"
              tableClassName="jobs-table metrics-table"
              columns={[
                "Queue",
                "Avg Duration",
                "Avg Wait",
                "Completed",
                "Failed",
              ]}
              rows={slowestQueues
                .slice(0, 5)
                .map((queue: QueueMetricSummary) => [
                  <Link
                    key={queue.name}
                    to="/queues/$queueName"
                    params={{ queueName: queue.name } as never}
                    className="mono"
                  >
                    {queue.name}
                  </Link>,
                  formatDurationMs(queue.avgDurationMs),
                  formatDurationMs(queue.avgWaitMs),
                  queue.completed.toLocaleString(),
                  queue.failed.toLocaleString(),
                ])}
            />
          ) : (
            <div className="metrics-empty muted">
              No queue-level metrics yet.
            </div>
          )}
        </Section>

        <Section
          title="Failing queues"
          subtitle="Sorted by failures, then error rate"
        >
          {failingQueues.length ? (
            <Table
              wrapperClassName="jobs-table-scroll"
              tableClassName="jobs-table metrics-table"
              columns={["Queue", "Error Rate", "Failed", "Completed", "Retry"]}
              rows={failingQueues
                .slice(0, 5)
                .map((queue: QueueMetricSummary) => [
                  <Link
                    key={queue.name}
                    to="/queues/$queueName"
                    params={{ queueName: queue.name } as never}
                    className="mono"
                  >
                    {queue.name}
                  </Link>,
                  formatPercent(queue.errorRate),
                  queue.failed.toLocaleString(),
                  queue.completed.toLocaleString(),
                  queue.retry.toLocaleString(),
                ])}
            />
          ) : (
            <div className="metrics-empty muted">
              No queue-level metrics yet.
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

export function QueuesPage() {
  const { data, isLoading, error } = useQueues();
  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading queues…" />;
  if (error)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Queues unavailable"
        description={error.message}
      />
    );
  const queues = data ?? [];

  if (!queues.length) {
    return (
      <EmptyState
        icon={Inbox}
        title="No queues yet"
        description="Create a pg-boss queue to start seeing jobs and backlog counts."
      />
    );
  }

  return (
    <Section title="Queues" subtitle={`${queues.length} queues`}>
      <Table
        columns={[
          "Queue",
          "Total",
          "Created",
          "Retry",
          "Active",
          "Completed",
          "Cancelled",
          "Failed",
        ]}
        rows={queues.map((queue: QueueInfo) => [
          <Link
            key={queue.name}
            to="/queues/$queueName"
            params={{ queueName: queue.name } as never}
            className="mono"
          >
            {queue.name}
          </Link>,
          queue.total,
          queue.created,
          queue.retry,
          queue.active,
          queue.completed,
          queue.cancelled,
          queue.failed,
        ])}
      />
    </Section>
  );
}

export function QueuePage() {
  const params = useParams({ strict: false }) as { queueName: string };
  const queueName = params.queueName;
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const { data, isLoading, error } = useQueue(queueName);
  const [payloadInput, setPayloadInput] = useState("");
  const [priorityInput, setPriorityInput] = useState("");
  const [feedback, setFeedback] = useState<JobFeedbackState>(null);
  const [previewState, setPreviewState] =
    useState<QueueCleanPreviewState>(null);
  const [deleteState, setDeleteState] = useState<QueueCleanDeleteState>(null);
  const [previewStateInput, setPreviewStateInput] = useState<
    "completed" | "failed"
  >("completed");
  const [previewAgeInput, setPreviewAgeInput] = useState("3600");
  const [previewLimitInput, setPreviewLimitInput] = useState("1000");
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [enqueueInFlight, setEnqueueInFlight] = useState(false);
  const queueNameRef = useRef(queueName);
  const actionsEnabled = !!config?.hasBoss && !config.readonly;
  const manualEnqueueEnabled = actionsEnabled && !!config?.allowManualEnqueue;
  const queueCleanPreviewEnabled = actionsEnabled && !!config?.allowQueueClean;
  const queueCleanDeleteEnabled =
    queueCleanPreviewEnabled && !!config?.allowQueueCleanDelete;
  const previewInFlight = previewState?.status === "running";
  const deleteInFlight = deleteState?.status === "running";
  const previewSuccess =
    previewState?.status === "success" && !!previewState.result;
  const deleteReady =
    queueCleanDeleteEnabled &&
    previewSuccess &&
    previewState?.result?.queue === queueName;
  const expectedDeleteConfirmation = previewState?.result
    ? `clean ${previewState.result.state} ${previewState.result.queue}`
    : "";
  const deleteConfirmMatches =
    deleteReady && deleteConfirmInput === expectedDeleteConfirmation;

  const resetQueueCleanPreview = () => {
    setPreviewState(null);
    setDeleteConfirmInput("");
  };

  useEffect(() => {
    queueNameRef.current = queueName;
    setPreviewState((current) =>
      current?.result?.queue === queueName ? current : null,
    );
    setDeleteState((current) =>
      current?.result?.queue === queueName ? current : null,
    );
    setDeleteConfirmInput("");
  }, [queueName]);

  const enqueueJob = async () => {
    if (enqueueInFlight) return;
    setEnqueueInFlight(true);
    setFeedback({ kind: "running", message: "Enqueue job…" });

    try {
      const request = parseEnqueuePayloadInput(payloadInput, priorityInput);
      const response = await api.enqueueJob(queueName, request);
      const jobId =
        response &&
        typeof response === "object" &&
        "result" in response &&
        response.result &&
        typeof response.result === "object" &&
        "id" in response.result
          ? String((response.result as { id?: unknown }).id ?? "")
          : "";

      await invalidateQueueActionQueries(queryClient, queueName);
      setPayloadInput("");
      setPriorityInput("");
      setFeedback({
        kind: "success",
        message: jobId ? `Enqueued job ${jobId}.` : "Job enqueued.",
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Enqueue failed",
      });
    } finally {
      setEnqueueInFlight(false);
    }
  };

  const previewQueueClean = async () => {
    if (!queueCleanPreviewEnabled || previewInFlight || deleteInFlight) return;
    setPreviewState({ status: "running", message: "Loading preview…" });
    setDeleteState(null);
    setDeleteConfirmInput("");
    try {
      const request = {
        state: previewStateInput,
        olderThanSeconds: Number(previewAgeInput),
        ...(previewLimitInput ? { limit: Number(previewLimitInput) } : {}),
      };
      const response = await api.previewQueueClean(queueName, request);
      if (queueNameRef.current !== queueName) return;
      setPreviewState({
        status: "success",
        message: "Preview loaded.",
        result: response.result,
      });
    } catch (error) {
      if (queueNameRef.current !== queueName) return;
      setPreviewState({
        status: "error",
        message: error instanceof Error ? error.message : "Preview failed",
      });
    }
  };

  const cleanQueue = async () => {
    if (!deleteReady || !deleteConfirmMatches || deleteInFlight) return;
    const previewResult = previewState?.result;
    if (!previewResult) return;

    setDeleteState({ status: "running", message: "Deleting jobs…" });
    try {
      const request = {
        state: previewResult.state,
        cutoff: previewResult.cutoff,
        confirm: deleteConfirmInput,
        ...(previewLimitInput ? { limit: Number(previewLimitInput) } : {}),
      };
      const response = await api.cleanQueue(queueName, {
        ...request,
      });
      if (queueNameRef.current !== queueName) return;
      await invalidateQueueActionQueries(queryClient, queueName);
      await queryClient.invalidateQueries({ queryKey: queryKeys.deadLetter });
      setPreviewState(null);
      setDeleteConfirmInput("");
      setDeleteState({
        status: "success",
        message: `Deleted ${response.result.deleted.toLocaleString()} job${response.result.deleted === 1 ? "" : "s"}.`,
        result: response.result,
      });
    } catch (error) {
      if (queueNameRef.current !== queueName) return;
      setDeleteState({
        status: "error",
        message: error instanceof Error ? error.message : "Delete failed",
      });
    }
  };

  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading queue…" />;
  if (error || !data)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Queue unavailable"
        description={error?.message ?? "Not found"}
      />
    );

  return (
    <div className="section">
      <div className="stats-grid">
        <SummaryCard title="Total" value={data.total} subtitle="All jobs" />
        <SummaryCard title="Active" value={data.active} subtitle="Processing" />
        <SummaryCard
          title="Failed"
          value={data.failed}
          subtitle="Needs attention"
        />
        <SummaryCard
          title="Completed"
          value={data.completed}
          subtitle="Finished"
        />
      </div>
      {manualEnqueueEnabled ? (
        <Section
          title="Manual enqueue"
          subtitle="Writes a live job into this queue"
        >
          <div className="stack" style={{ gap: 12 }}>
            <div className="banner compact" role="note">
              Production write: this inserts a job through pg-boss.
            </div>
            <textarea
              className="input"
              value={payloadInput}
              onChange={(event) => setPayloadInput(event.target.value)}
              placeholder='Optional JSON payload (for example: {"foo":"bar"})'
              aria-label="Manual enqueue JSON payload"
              style={{ minHeight: 92, height: "auto", resize: "vertical" }}
            />
            <div className="filters" style={{ alignItems: "end" }}>
              <div
                className="stack"
                style={{ minWidth: 180, flex: "0 1 180px" }}
              >
                <span className="muted">Priority</span>
                <Input
                  type="number"
                  value={priorityInput}
                  onChange={(event) => setPriorityInput(event.target.value)}
                  placeholder="Optional"
                  aria-label="Manual enqueue priority"
                />
              </div>
              <Button
                type="button"
                disabled={!manualEnqueueEnabled || enqueueInFlight}
                onClick={() => void enqueueJob()}
              >
                Enqueue job
              </Button>
            </div>
          </div>
        </Section>
      ) : null}
      {feedback ? (
        <div className="banner compact">{feedback.message}</div>
      ) : null}
      {queueCleanPreviewEnabled ? (
        <Section
          title="Queue clean preview"
          subtitle={
            queueCleanDeleteEnabled
              ? "Preview matching jobs before the irreversible delete"
              : "Preview only; no jobs are deleted"
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            <div className="filters" style={{ alignItems: "end" }}>
              <div
                className="stack"
                style={{ minWidth: 160, flex: "0 1 160px" }}
              >
                <span className="muted">State</span>
                <select
                  value={previewStateInput}
                  disabled={previewInFlight || deleteInFlight}
                  onChange={(e) => {
                    setPreviewStateInput(
                      e.target.value as "completed" | "failed",
                    );
                    resetQueueCleanPreview();
                  }}
                >
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div
                className="stack"
                style={{ minWidth: 180, flex: "0 1 180px" }}
              >
                <span className="muted">Older than seconds</span>
                <Input
                  type="number"
                  value={previewAgeInput}
                  disabled={previewInFlight || deleteInFlight}
                  onChange={(e) => {
                    setPreviewAgeInput(e.target.value);
                    resetQueueCleanPreview();
                  }}
                />
              </div>
              <div
                className="stack"
                style={{ minWidth: 180, flex: "0 1 180px" }}
              >
                <span className="muted">Limit</span>
                <Input
                  type="number"
                  value={previewLimitInput}
                  disabled={previewInFlight || deleteInFlight}
                  onChange={(e) => {
                    setPreviewLimitInput(e.target.value);
                    resetQueueCleanPreview();
                  }}
                />
              </div>
              <Button
                type="button"
                disabled={
                  !queueCleanPreviewEnabled || previewInFlight || deleteInFlight
                }
                onClick={() => void previewQueueClean()}
              >
                {previewInFlight ? "Loading preview…" : "Preview clean"}
              </Button>
            </div>
            {previewState ? (
              <div className="banner compact">{previewState.message}</div>
            ) : null}
            {previewState?.result ? (
              <div className="stack" style={{ gap: 8 }}>
                <div>Queue: {previewState.result.queue}</div>
                <div>State: {previewState.result.state}</div>
                <div>
                  Matched jobs: {previewState.result.matched.toLocaleString()}
                </div>
                <div>Cutoff: {previewState.result.cutoff}</div>
                <div>
                  Sample IDs:{" "}
                  {previewState.result.sampleIds.length
                    ? previewState.result.sampleIds.join(", ")
                    : "None"}
                </div>
                <div>
                  {previewState.result.hasMore
                    ? "More jobs match beyond the sample."
                    : "All matching jobs shown."}
                </div>
              </div>
            ) : null}
            {deleteReady ? (
              <div className="stack" style={{ gap: 12, marginTop: 4 }}>
                <div className="banner compact" role="note">
                  <strong>Irreversible cleanup.</strong> This permanently
                  deletes matching {previewState.result?.state} jobs from queue{" "}
                  {previewState.result?.queue}.{" "}
                  {previewState.result
                    ? queueCleanDeleteWarningCopy(previewState.result.state)
                    : null}
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <div className="muted">
                    Type{" "}
                    <span className="mono">{expectedDeleteConfirmation}</span>{" "}
                    to enable deletion.
                  </div>
                  <Input
                    value={deleteConfirmInput}
                    disabled={deleteInFlight || previewInFlight}
                    onChange={(event) =>
                      setDeleteConfirmInput(event.target.value)
                    }
                    aria-label="Delete confirmation"
                    placeholder={expectedDeleteConfirmation}
                  />
                  <div className="filters" style={{ alignItems: "center" }}>
                    <Button
                      type="button"
                      className="danger"
                      disabled={
                        !deleteReady ||
                        !deleteConfirmMatches ||
                        deleteInFlight ||
                        previewInFlight
                      }
                      onClick={() => void cleanQueue()}
                    >
                      {deleteInFlight ? "Deleting…" : "Delete matching jobs"}
                    </Button>
                    <div className="muted">This action cannot be undone.</div>
                  </div>
                </div>
              </div>
            ) : null}
            {deleteState ? (
              <div className="banner compact" role="status">
                <div>{deleteState.message}</div>
                {deleteState.result ? (
                  <div className="stack" style={{ gap: 4, marginTop: 8 }}>
                    <div>
                      Deleted IDs:{" "}
                      {deleteState.result.deletedIds.length
                        ? deleteState.result.deletedIds.join(", ")
                        : "None"}
                    </div>
                    <div>Cutoff: {deleteState.result.cutoff}</div>
                    <div>
                      Has more: {deleteState.result.hasMore ? "Yes" : "No"}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}
      <Section title={data.name} subtitle="Recent jobs">
        {data.recentJobs.length ? (
          <Table
            columns={[
              "Job",
              "State",
              "Failure",
              "Created",
              "Completed",
              "Priority",
            ]}
            rows={data.recentJobs.map((job: JobSummary) => [
              <Link
                key={job.id}
                to="/jobs/$jobId"
                params={{ jobId: job.id } as never}
                className="mono"
              >
                {truncate(job.name, 30)}
              </Link>,
              <StatusBadge key={`${job.id}-state`} state={job.state} />,
              failureSnippetForJobSummary(job),
              <RelativeTime
                key={`${job.id}-created`}
                timestamp={job.createdOn}
              />,
              <RelativeTime
                key={`${job.id}-completed`}
                timestamp={job.completedOn}
              />,
              job.priority ?? "—",
            ])}
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title="No recent jobs"
            description="This queue has no recent jobs yet."
          />
        )}
      </Section>
    </div>
  );
}

const JOB_STATES: Array<{ value: BossbenchJobState | "all"; label: string }> = [
  { value: "all", label: "All states" },
  { value: "created", label: "Created" },
  { value: "retry", label: "Retry" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failed", label: "Failed" },
];

const JOB_PAGE_SIZES = [10, 25, 50, 100] as const;

export function RunsPage() {
  const { data: config } = useConfig();
  const { data: queues } = useQueues();
  const queryClient = useQueryClient();
  const { searchQuery, setSearchQuery } = useDashboardSearch();
  const [queue, setQueue] = useState("all");
  const [state, setState] = useState<BossbenchJobState | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tagValues, setTagValues] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<string | undefined>("created_on:desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkActionState, setBulkActionState] = useState<BulkActionState>(null);
  const headerSelectionRef = useRef<HTMLInputElement>(null);
  const bulkActionInFlightRef = useRef(false);
  const currentSort = parseSort(sort);
  const configuredTags = useMemo(() => config?.tags ?? [], [config?.tags]);
  const lastSearchQuery = useRef(searchQuery);
  const shouldResetOffset = lastSearchQuery.current !== searchQuery;
  const offsetForQuery = shouldResetOffset ? 0 : offset;

  useEffect(() => {
    setTagValues((current) => {
      const next: Record<string, string> = {};
      let changed = false;

      for (const tag of configuredTags) {
        const value = current[tag] ?? "";
        next[tag] = value;
        if (current[tag] !== value) changed = true;
      }

      for (const key of Object.keys(current)) {
        if (!configuredTags.includes(key)) {
          changed = true;
          break;
        }
      }

      return changed ? next : current;
    });
  }, [configuredTags]);

  useEffect(() => {
    if (lastSearchQuery.current !== searchQuery) {
      lastSearchQuery.current = searchQuery;
      setOffset(0);
    }
  }, [searchQuery]);

  const tagFilters = useMemo(() => {
    const filters: Record<string, string[]> = {};

    for (const tag of configuredTags) {
      const value = tagValues[tag]?.trim();
      if (value) filters[tag] = [value];
    }

    return filters;
  }, [configuredTags, tagValues]);

  const filters = useMemo(
    () => ({
      ...(searchQuery ? { q: searchQuery } : {}),
      ...(queue === "all" ? {} : { queue }),
      ...(state === "all" ? {} : { state }),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(sort ? { sort } : {}),
      limit,
      offset: offsetForQuery,
      ...(Object.keys(tagFilters).length ? { tags: tagFilters } : {}),
    }),
    [
      searchQuery,
      queue,
      state,
      from,
      to,
      sort,
      limit,
      offsetForQuery,
      tagFilters,
    ],
  );

  const { data, isLoading, error } = useJobs(filters);
  const lastLoadedTotal = useRef<number | null>(null);

  useEffect(() => {
    if (data) lastLoadedTotal.current = data.total;
  }, [data]);

  const total = data?.total ?? lastLoadedTotal.current ?? 0;
  const maxOffset = total > 0 ? Math.floor((total - 1) / limit) * limit : 0;
  const safeOffset = data
    ? Math.min(offsetForQuery, maxOffset)
    : offsetForQuery;

  useEffect(() => {
    if (offset !== safeOffset) setOffset(safeOffset);
  }, [offset, safeOffset]);

  const rows = data?.items ?? [];
  const pageStart = total ? safeOffset + 1 : 0;
  const pageEnd = total ? Math.min(safeOffset + limit, total) : 0;
  const queueOptions = queues ?? [];
  const canGoPrevious = safeOffset > 0;
  const canGoNext = total > safeOffset + limit;
  const visibleIds = rows.map((job: JobSummary) => job.id);
  const visibleSelectedCount = visibleIds.filter((id: string) =>
    selectedIds.has(id),
  ).length;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;
  const bulkActionsEnabled = !!config?.hasBoss && !config.readonly;
  const isBulkActionRunning = bulkActionState?.status === "running";
  const selectedCount = selectedIds.size;
  const selectionResetKey = useMemo(
    () =>
      JSON.stringify({
        searchQuery,
        queue,
        state,
        from,
        to,
        sort,
        limit,
        offsetForQuery,
        tagFilters,
      }),
    [
      searchQuery,
      queue,
      state,
      from,
      to,
      sort,
      limit,
      offsetForQuery,
      tagFilters,
    ],
  );

  useEffect(() => {
    if (headerSelectionRef.current) {
      headerSelectionRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  useEffect(() => {
    if (selectionResetKey) setSelectedIds(new Set());
  }, [selectionResetKey]);

  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading jobs…" />;
  if (error)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Jobs unavailable"
        description={error.message}
      />
    );

  const updateSearch = (value: string) => {
    setOffset(0);
    setSearchQuery(value);
  };

  const updateQueue = (value: string) => {
    setOffset(0);
    setQueue(value);
  };

  const updateState = (value: string) => {
    setOffset(0);
    setState(value as BossbenchJobState | "all");
  };

  const updateFrom = (value: string) => {
    setOffset(0);
    setFrom(value);
  };

  const updateTo = (value: string) => {
    setOffset(0);
    setTo(value);
  };

  const updateLimit = (value: string) => {
    setOffset(0);
    setLimit(Number(value));
  };

  const updateTag = (field: string, value: string) => {
    setOffset(0);
    setTagValues((current) => ({ ...current, [field]: value }));
  };

  const updateSort = (
    field: string | undefined,
    direction: "asc" | "desc" | undefined,
  ) => {
    setOffset(0);
    setSort(field && direction ? createSort(field, direction) : undefined);
  };

  const toggleVisibleSelection = (checked: boolean) => {
    if (isBulkActionRunning) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const toggleJobSelection = (id: string, checked: boolean) => {
    if (isBulkActionRunning) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runBulkAction = async (
    label: string,
    action: (
      ids: string[],
    ) => Promise<{ ok: true; result: BulkJobActionResult }>,
    ids: string[],
  ) => {
    if (bulkActionInFlightRef.current) return;

    const selected = [...ids];
    bulkActionInFlightRef.current = true;
    setBulkActionState({ status: "running", label });
    try {
      const response = await action(selected);
      setSelectedIds(new Set());
      const failureSummary = summarizeBulkFailures(response.result.failed);
      setBulkActionState({
        status: "complete",
        label,
        message: `${label} complete: ${response.result.succeeded.length} succeeded, ${response.result.failed.length} failed.${failureSummary ? ` ${failureSummary}` : ""}`,
      });
      await invalidateBulkActionQueries(queryClient);
    } catch (error) {
      setBulkActionState({
        status: "error",
        label,
        message: error instanceof Error ? error.message : `${label} failed`,
      });
    } finally {
      bulkActionInFlightRef.current = false;
    }
  };

  return (
    <Section
      title="Jobs"
      subtitle={`${total.toLocaleString()} matched${total ? ` • ${pageStart}-${pageEnd}` : ""}`}
      actions={
        <div className="jobs-toolbar">
          <SmartSearch
            value={searchQuery}
            onValueChange={updateSearch}
            placeholder="Search jobs…"
            disabled={isBulkActionRunning}
          />
          <div className="filter-grid">
            <div className="job-filter">
              <span>Queue</span>
              <select
                aria-label="Queue"
                value={queue}
                onChange={(event) => updateQueue(event.target.value)}
                disabled={isBulkActionRunning}
              >
                <option value="all">All queues</option>
                {queueOptions.map((item: { name: string }) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="job-filter">
              <span>State</span>
              <select
                aria-label="State"
                value={state}
                onChange={(event) => updateState(event.target.value)}
                disabled={isBulkActionRunning}
              >
                {JOB_STATES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="job-filter">
              <span>From</span>
              <Input
                aria-label="From"
                type="datetime-local"
                value={from}
                onChange={(event) => updateFrom(event.target.value)}
                disabled={isBulkActionRunning}
              />
            </div>
            <div className="job-filter">
              <span>To</span>
              <Input
                aria-label="To"
                type="datetime-local"
                value={to}
                onChange={(event) => updateTo(event.target.value)}
                disabled={isBulkActionRunning}
              />
            </div>
            <div className="job-filter">
              <span>Page size</span>
              <select
                aria-label="Page size"
                value={String(limit)}
                onChange={(event) => updateLimit(event.target.value)}
                disabled={isBulkActionRunning}
              >
                {JOB_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pagination-row">
            <div className="job-pagination">
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setOffset((current) => Math.max(0, current - limit))
                }
                disabled={!canGoPrevious || isBulkActionRunning}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOffset((current) => current + limit)}
                disabled={!canGoNext || isBulkActionRunning}
              >
                Next
              </Button>
            </div>
            <div className="job-pagination-info muted">
              {total
                ? `Showing ${pageStart}-${pageEnd} of ${total.toLocaleString()}`
                : "No jobs matched yet"}
            </div>
          </div>
          {configuredTags.length ? (
            <div className="job-tag-grid">
              {configuredTags.map((tag: string) => (
                <div className="job-filter" key={tag}>
                  <span>{tag}</span>
                  <Input
                    aria-label={`Filter ${tag}`}
                    value={tagValues[tag] ?? ""}
                    onChange={(event) => updateTag(tag, event.target.value)}
                    placeholder={`Filter ${tag}`}
                    disabled={isBulkActionRunning}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      }
    >
      {bulkActionState ? (
        <section className="banner compact" aria-live="polite">
          {bulkActionState.status === "running"
            ? `${bulkActionState.label}…`
            : bulkActionState.message}
        </section>
      ) : null}
      {selectedCount ? (
        <section
          className="banner compact bulk-action-bar"
          aria-label="Bulk job actions"
        >
          <div className="job-bulk-summary">
            <strong>{selectedCount} selected</strong>
            <span className="muted">
              {bulkActionsEnabled
                ? "Apply actions to the visible jobs on this page."
                : "Bulk actions require a writable pg-boss instance."}
            </span>
          </div>
          <div className="filters">
            <Button
              type="button"
              variant="ghost"
              disabled={!bulkActionsEnabled || isBulkActionRunning}
              onClick={() =>
                void runBulkAction(
                  "Retry selected",
                  api.bulkRetryJobs,
                  Array.from(selectedIds),
                )
              }
            >
              Retry selected
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!bulkActionsEnabled || isBulkActionRunning}
              onClick={() =>
                void runBulkAction(
                  "Cancel selected",
                  api.bulkCancelJobs,
                  Array.from(selectedIds),
                )
              }
            >
              Cancel selected
            </Button>
            <Button
              type="button"
              className="danger"
              disabled={!bulkActionsEnabled || isBulkActionRunning}
              onClick={() => {
                const ids = Array.from(selectedIds);
                if (
                  !window.confirm(
                    `Delete ${ids.length} selected job${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
                  )
                ) {
                  return;
                }
                void runBulkAction("Delete selected", api.bulkDeleteJobs, ids);
              }}
            >
              Delete selected
            </Button>
          </div>
        </section>
      ) : null}
      <Table
        wrapperClassName="jobs-table-scroll"
        tableClassName="jobs-table"
        columnClassNames={[
          "checkbox-cell",
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
        ]}
        columns={[
          <input
            key="select"
            ref={headerSelectionRef}
            type="checkbox"
            aria-label="Select visible jobs"
            checked={allVisibleSelected}
            disabled={!rows.length || isBulkActionRunning}
            onChange={(event) => toggleVisibleSelection(event.target.checked)}
          />,
          "ID",
          <SortableHeader
            key="name"
            field="name"
            label="Queue"
            currentSort={currentSort}
            onSort={updateSort}
          />,
          <SortableHeader
            key="state"
            field="state"
            label="State"
            currentSort={currentSort}
            onSort={updateSort}
          />,
          "Failure",
          <SortableHeader
            key="created_on"
            field="created_on"
            label="Created"
            currentSort={currentSort}
            onSort={updateSort}
          />,
          <SortableHeader
            key="completed_on"
            field="completed_on"
            label="Completed"
            currentSort={currentSort}
            onSort={updateSort}
          />,
          <SortableHeader
            key="priority"
            field="priority"
            label="Priority"
            currentSort={currentSort}
            onSort={updateSort}
          />,
        ]}
        rows={rows.map((job: JobSummary) => [
          <input
            key={`${job.id}-select`}
            type="checkbox"
            aria-label={`Select job ${job.id}`}
            checked={selectedIds.has(job.id)}
            disabled={isBulkActionRunning}
            onChange={(event) =>
              toggleJobSelection(job.id, event.target.checked)
            }
          />,
          <Link
            key={job.id}
            to="/jobs/$jobId"
            params={{ jobId: job.id } as never}
            className="mono"
          >
            {truncate(job.id, 12)}
          </Link>,
          job.queue,
          <StatusBadge key={`${job.id}-state`} state={job.state} />,
          failureSnippetForJobSummary(job),
          <RelativeTime key={`${job.id}-created`} timestamp={job.createdOn} />,
          <RelativeTime
            key={`${job.id}-completed`}
            timestamp={job.completedOn}
          />,
          job.priority ?? "—",
        ])}
      />
      {!rows.length ? (
        <EmptyState
          icon={SearchX}
          title="No jobs matched"
          description={
            searchQuery ||
            state !== "all" ||
            queue !== "all" ||
            from ||
            to ||
            Object.keys(tagFilters).length
              ? "Relax the search or filters to find more jobs."
              : "No jobs have been recorded yet."
          }
        />
      ) : null}
    </Section>
  );
}

export function FutureJobsPage() {
  const { data: queues } = useQueues();
  const { searchQuery, setSearchQuery } = useDashboardSearch();
  const [queue, setQueue] = useState("all");
  const [state, setState] = useState<BossbenchJobState | "all">("all");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<string | undefined>(() =>
    futureJobsDefaultSort(),
  );
  const currentSort = parseSort(sort);
  const lastSearchQuery = useRef(searchQuery);
  const shouldResetOffset = lastSearchQuery.current !== searchQuery;
  const offsetForQuery = shouldResetOffset ? 0 : offset;
  const filters = useMemo(
    () => ({
      ...(searchQuery ? { q: searchQuery } : {}),
      ...(queue === "all" ? {} : { queue }),
      ...(state === "all" ? {} : { state }),
      ...(sort ? { sort } : {}),
      limit,
      offset: offsetForQuery,
    }),
    [searchQuery, queue, state, sort, limit, offsetForQuery],
  );
  const { data, isLoading, error } = useFutureJobs(filters);
  const total = data?.total ?? 0;
  const maxOffset = total > 0 ? Math.floor((total - 1) / limit) * limit : 0;
  const safeOffset = data
    ? Math.min(offsetForQuery, maxOffset)
    : offsetForQuery;
  const rows = data?.items ?? [];
  const pageStart = total ? safeOffset + 1 : 0;
  const pageEnd = total ? Math.min(safeOffset + limit, total) : 0;
  const hasFilters = !!searchQuery || queue !== "all" || state !== "all";

  useEffect(() => {
    if (lastSearchQuery.current !== searchQuery) {
      lastSearchQuery.current = searchQuery;
      setOffset(0);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (offset !== safeOffset) setOffset(safeOffset);
  }, [offset, safeOffset]);

  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading future jobs…" />;
  if (error)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Future jobs unavailable"
        description={error.message}
      />
    );

  const updateSort = (
    field: string | undefined,
    direction: "asc" | "desc" | undefined,
  ) => {
    setOffset(0);
    setSort(field && direction ? createSort(field, direction) : undefined);
  };

  return (
    <Section
      title="Future Jobs"
      subtitle={futureJobsSubtitle(total, pageStart, pageEnd)}
      actions={
        <div className="jobs-toolbar">
          <SmartSearch
            value={searchQuery}
            onValueChange={(value) => {
              setOffset(0);
              setSearchQuery(value);
            }}
            placeholder="Search future jobs…"
          />
          <div className="filter-grid">
            <div className="job-filter">
              <span>Queue</span>
              <select
                aria-label="Queue"
                value={queue}
                onChange={(event) => {
                  setOffset(0);
                  setQueue(event.target.value);
                }}
              >
                <option value="all">All queues</option>
                {(queues ?? []).map((item: { name: string }) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="job-filter">
              <span>State</span>
              <select
                aria-label="State"
                value={state}
                onChange={(event) => {
                  setOffset(0);
                  setState(event.target.value as BossbenchJobState | "all");
                }}
              >
                <option value="all">Created + retry</option>
                <option value="created">Created</option>
                <option value="retry">Retry</option>
              </select>
            </div>
            <div className="job-filter">
              <span>Page size</span>
              <select
                aria-label="Page size"
                value={String(limit)}
                onChange={(event) => {
                  setOffset(0);
                  setLimit(Number(event.target.value));
                }}
              >
                {JOB_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pagination-row">
            <div className="job-pagination">
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setOffset((current) => Math.max(0, current - limit))
                }
                disabled={safeOffset <= 0}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOffset((current) => current + limit)}
                disabled={total <= safeOffset + limit}
              >
                Next
              </Button>
            </div>
            <div className="job-pagination-info muted">
              Future jobs are concrete pg-boss job rows with future start_after
              timestamps. Schedules stay separate.
            </div>
          </div>
        </div>
      }
    >
      <Table
        wrapperClassName="jobs-table-scroll"
        tableClassName="jobs-table"
        columns={[
          "ID",
          <SortableHeader
            key="name"
            field="name"
            label="Queue"
            currentSort={currentSort}
            onSort={updateSort}
          />,
          <SortableHeader
            key="state"
            field="state"
            label="State"
            currentSort={currentSort}
            onSort={updateSort}
          />,
          <SortableHeader
            key="start_after"
            field="start_after"
            label="Starts"
            currentSort={currentSort}
            onSort={updateSort}
          />,
          <SortableHeader
            key="created_on"
            field="created_on"
            label="Created"
            currentSort={currentSort}
            onSort={updateSort}
          />,
          <SortableHeader
            key="priority"
            field="priority"
            label="Priority"
            currentSort={currentSort}
            onSort={updateSort}
          />,
        ]}
        rows={rows.map((job: JobSummary) => [
          <Link
            key={job.id}
            to="/jobs/$jobId"
            params={{ jobId: job.id } as never}
            className="mono"
          >
            {truncate(job.id, 12)}
          </Link>,
          job.queue,
          <StatusBadge key={`${job.id}-state`} state={job.state} />,
          <RelativeTime key={`${job.id}-starts`} timestamp={job.startAfter} />,
          <RelativeTime key={`${job.id}-created`} timestamp={job.createdOn} />,
          job.priority ?? "—",
        ])}
      />
      {!rows.length ? (
        <EmptyState
          icon={Clock3}
          title="No future jobs"
          description={futureJobsEmptyDescription(hasFilters)}
        />
      ) : null}
    </Section>
  );
}

export function JobPage() {
  const params = useParams({ strict: false }) as { jobId: string };
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const { data, isLoading, error } = useJob(params.jobId);
  const [activeTab, setActiveTab] = useState<JobDetailTab>("summary");
  const [feedback, setFeedback] = useState<JobFeedbackState>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const actionInFlightRef = useRef(false);
  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading job…" />;
  if (error || !data)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Job unavailable"
        description={error?.message ?? "Not found"}
      />
    );
  const job = data as JobDetail;
  const actionsEnabled = !!config?.hasBoss && !config.readonly;
  const manualEnqueueEnabled = actionsEnabled && !!config?.allowManualEnqueue;

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback({ kind: "success", message: `${label} copied.` });
    } catch {
      setFeedback({ kind: "error", message: `${label} copy failed.` });
    }
  };

  const copyJson = (label: string, value: unknown) =>
    copyText(label, stringifyForClipboard(value));

  const exportJob = () => {
    const payload = stringifyForClipboard(buildJobExport(job));
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = jobExportFilename(job.id);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback({ kind: "success", message: "Job export downloaded." });
  };

  const runAction = async (
    label: string,
    action: () => Promise<unknown>,
    successMessage?: string | ((result: unknown) => string),
  ) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setActionInFlight(true);
    setFeedback({ kind: "running", message: `${label}…` });
    try {
      const result = await action();
      await invalidateJobActionQueries(queryClient, job.id);
      setFeedback({
        kind: "success",
        message:
          typeof successMessage === "function"
            ? successMessage(result)
            : (successMessage ?? `${label} complete.`),
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : `${label} failed`,
      });
    } finally {
      actionInFlightRef.current = false;
      setActionInFlight(false);
    }
  };

  const deleteJob = () => {
    if (!window.confirm(`Delete job ${job.id}? This cannot be undone.`)) return;
    void runAction("Delete", () => api.deleteJob(job.id));
  };

  const tabs: Array<{ value: JobDetailTab; label: string }> = [
    { value: "summary", label: "Summary" },
    { value: "payload", label: "Payload" },
    { value: "output", label: "Output" },
    { value: "timeline", label: "Timeline" },
    { value: "raw", label: "Raw" },
  ];
  const timeline = buildJobTimeline(job);
  const timelineEvents = timeline.filter(
    (event) => event.display === "timeline",
  );
  const timelineContext = timeline.filter(
    (event) => event.display === "context",
  );
  const operationalContext = buildJobOperationalContext(job);
  const hasOperationalContext =
    operationalContext.cards.length > 0 ||
    operationalContext.nextChecks.length > 0;
  const hasDeadLetter = job.deadLetter !== null && job.deadLetter !== undefined;

  const focusTab = (tab: JobDetailTab) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`job-detail-tab-${tab}`)?.focus();
    });
  };

  const selectTab = (tab: JobDetailTab, moveFocus = false) => {
    setActiveTab(tab);
    if (moveFocus) focusTab(tab);
  };

  const selectAdjacentTab = (direction: 1 | -1) => {
    const index = tabs.findIndex((tab) => tab.value === activeTab);
    const next = (index + direction + tabs.length) % tabs.length;
    selectTab(tabs[next]?.value ?? "summary", true);
  };

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectAdjacentTab(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectAdjacentTab(-1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectTab("summary", true);
    }
    if (event.key === "End") {
      event.preventDefault();
      selectTab("raw", true);
    }
  };

  const metadataRows: Array<[string, ReactNode]> = [
    ["Queue", job.queue],
    ["State", <StatusBadge key="state" state={job.state} />],
    ["Created", <RelativeTime key="created" timestamp={job.createdOn} />],
    ["Started", <RelativeTime key="started" timestamp={job.startedOn} />],
    ["Completed", <RelativeTime key="completed" timestamp={job.completedOn} />],
    ["Priority", job.priority ?? "—"],
    ["Retry Count", job.retryCount ?? "—"],
    ["Retry Limit", job.retryLimit ?? "—"],
    ["Singleton Key", job.singletonKey ?? "—"],
    ["Expires In", job.expireInSeconds ?? "—"],
    ["Dead Letter", hasDeadLetter ? "Present" : "—"],
  ];

  const renderPanel = (tab: JobDetailTab, children: ReactNode) => (
    <div
      key={tab}
      id={`job-detail-panel-${tab}`}
      role="tabpanel"
      aria-labelledby={`job-detail-tab-${tab}`}
      className="job-detail-panel"
      hidden={activeTab !== tab}
    >
      {children}
    </div>
  );

  return (
    <div className="job-detail-page">
      <section className="panel job-detail-header">
        <div className="job-detail-title">
          <div>
            <p className="muted mono">{job.queue}</p>
            <h2>{job.name}</h2>
          </div>
          <StatusBadge state={job.state} />
        </div>
        <div className="job-detail-id-row">
          <span className="mono">{job.id}</span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void copyText("Job ID", job.id)}
          >
            Copy ID
          </Button>
        </div>
        <div className="job-detail-actions">
          <Button type="button" variant="ghost" onClick={exportJob}>
            Export JSON
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!actionsEnabled || actionInFlight}
            onClick={() => void runAction("Retry", () => api.retryJob(job.id))}
          >
            Retry
          </Button>
          {manualEnqueueEnabled ? (
            <Button
              type="button"
              variant="ghost"
              disabled={!actionsEnabled || actionInFlight}
              onClick={() =>
                void runAction(
                  "Enqueue copy",
                  () => api.cloneJob(job.id),
                  (result) => {
                    const jobId =
                      result &&
                      typeof result === "object" &&
                      "result" in result &&
                      result.result &&
                      typeof result.result === "object" &&
                      "id" in result.result
                        ? String((result.result as { id?: unknown }).id ?? "")
                        : "";
                    return jobId
                      ? `Enqueue copy created job ${jobId}.`
                      : "Enqueue copy complete.";
                  },
                )
              }
            >
              Enqueue copy
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={!actionsEnabled || actionInFlight}
            onClick={() =>
              void runAction("Cancel", () => api.cancelJob(job.id))
            }
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!actionsEnabled || actionInFlight}
            onClick={() =>
              void runAction("Resume", () => api.resumeJob(job.id))
            }
          >
            Resume
          </Button>
          <Button
            type="button"
            className="danger"
            disabled={!actionsEnabled || actionInFlight}
            onClick={deleteJob}
          >
            Delete
          </Button>
        </div>
        {!actionsEnabled ? (
          <div className="muted">
            Actions are disabled in browse-only mode or when no pg-boss instance
            is attached.
          </div>
        ) : null}
        {feedback ? (
          <div className="banner compact" aria-live="polite">
            {feedback.message}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="job-detail-tabs" role="tablist" aria-label="Job detail">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              className={`job-detail-tab${activeTab === tab.value ? " active" : ""}`}
              aria-selected={activeTab === tab.value}
              aria-controls={`job-detail-panel-${tab.value}`}
              id={`job-detail-tab-${tab.value}`}
              tabIndex={activeTab === tab.value ? 0 : -1}
              onClick={() => selectTab(tab.value)}
              onKeyDown={handleTabKeyDown}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {renderPanel(
          "summary",
          <div className="job-detail-panel-content">
            <div className="job-detail-meta-grid">
              {metadataRows.map(([label, value]) => (
                <div className="job-detail-meta-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            {hasOperationalContext ? (
              <div className="job-operational-context">
                <div className="job-detail-panel-head">
                  <div>
                    <h3>Failure and retry context</h3>
                    <p>
                      Derived from pg-boss job row data. Bossbench only shows
                      context that is available in this job record.
                    </p>
                  </div>
                </div>
                {operationalContext.cards.length ? (
                  <div className="job-operational-card-grid">
                    {operationalContext.cards.map((card) => (
                      <div
                        className={`job-operational-card ${card.tone}`}
                        key={`${card.title}-${card.description}`}
                      >
                        <span>{card.title}</span>
                        <strong>{card.description}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
                {operationalContext.nextChecks.length ? (
                  <div className="job-next-checks">
                    <span>Next checks</span>
                    <ul>
                      {operationalContext.nextChecks.map((check) => (
                        <li key={check}>{check}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>,
        )}

        {renderPanel(
          "payload",
          <div className="job-detail-panel-content">
            <JobJsonPanel
              title="Payload"
              subtitle="JSON data sent to pg-boss"
              data={job.data}
              onCopy={() => void copyJson("Payload", job.data)}
            />
          </div>,
        )}

        {renderPanel(
          "output",
          <div className="job-detail-panel-content">
            <JobJsonPanel
              title="Output"
              subtitle="Task result or failure output"
              data={job.output ?? null}
              defaultExpanded={false}
              onCopy={() => void copyJson("Output", job.output ?? null)}
            />
          </div>,
        )}

        {renderPanel(
          "timeline",
          <div className="job-detail-panel-content">
            <div className="job-detail-panel-head">
              <div>
                <h3>Timeline</h3>
                <p>
                  pg-boss lifecycle events and context derived from reliable job
                  row data.
                </p>
              </div>
            </div>
            <ol className="job-timeline">
              {timelineEvents.map((event) => (
                <li
                  className="job-timeline-event"
                  key={`${event.kind}-${event.title}`}
                >
                  <div className="job-timeline-marker" aria-hidden="true" />
                  <div className="job-timeline-card">
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.description}</p>
                    </div>
                    <span className="muted">
                      {event.timestamp ? (
                        <RelativeTime timestamp={event.timestamp} />
                      ) : (
                        "No timestamp"
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            {timelineContext.length ? (
              <div className="job-timeline-context-grid">
                {timelineContext.map((event) => (
                  <div
                    className="job-detail-meta-card"
                    key={`${event.kind}-${event.title}`}
                  >
                    <span>{event.title}</span>
                    <strong>{event.description}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </div>,
        )}

        {renderPanel(
          "raw",
          <div className="job-detail-panel-content">
            <JobJsonPanel
              title="Raw"
              subtitle="Raw pg-boss row"
              data={job.raw}
              defaultExpanded={false}
              onCopy={() => void copyJson("Raw", job.raw)}
            />
          </div>,
        )}
      </section>
    </div>
  );
}

function JobJsonPanel({
  title,
  subtitle,
  data,
  defaultExpanded = true,
  onCopy,
}: {
  title: string;
  subtitle: string;
  data: unknown;
  defaultExpanded?: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="job-detail-json-panel">
      <div className="job-detail-panel-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <Button type="button" variant="ghost" onClick={onCopy}>
          Copy JSON
        </Button>
      </div>
      <JsonViewer data={data} defaultExpanded={defaultExpanded} />
    </div>
  );
}

export function SchedulesPage() {
  const { data, isLoading, error } = useSchedules();
  const { data: config } = useConfig();
  const [actionState, setActionState] = useState<string | null>(null);
  const [scheduleActionInFlight, setScheduleActionInFlight] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleCron, setScheduleCron] = useState("");
  const [scheduleData, setScheduleData] = useState("");
  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading schedules…" />;
  if (error)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Schedules unavailable"
        description={error.message}
      />
    );
  const schedules = data ?? [];
  const actionsEnabled = !!config?.hasBoss && !config.readonly;

  const createSchedule = async () => {
    if (scheduleActionInFlight) return;
    setScheduleActionInFlight(true);
    setActionState(`Scheduling ${scheduleName}…`);
    try {
      const parsedData = parseScheduleDataInput(scheduleData);
      await api.createSchedule({
        name: scheduleName,
        cron: scheduleCron,
        ...(parsedData === undefined ? {} : { data: parsedData }),
      });
      setScheduleData("");
      setActionState("Schedule created. Refreshing…");
      window.setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setActionState(
        error instanceof Error ? error.message : "Schedule failed",
      );
    } finally {
      setScheduleActionInFlight(false);
    }
  };

  const unschedule = async (name: string) => {
    if (scheduleActionInFlight) return;
    setScheduleActionInFlight(true);
    setActionState(`Unscheduling ${name}…`);
    try {
      await api.unschedule(name);
      setActionState("Unschedule complete. Refreshing…");
      window.setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setActionState(
        error instanceof Error ? error.message : "Unschedule failed",
      );
    } finally {
      setScheduleActionInFlight(false);
    }
  };

  const runNow = async (name: string) => {
    if (scheduleActionInFlight) return;
    setScheduleActionInFlight(true);
    setActionState(`Running ${name} once now…`);
    try {
      const response = await api.runScheduleNow(name);
      setActionState(
        response.result.id
          ? `Run now enqueued job ${response.result.id}. Refreshing…`
          : "Run now requested, but pg-boss did not enqueue a job.",
      );
      window.setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setActionState(error instanceof Error ? error.message : "Run now failed");
    } finally {
      setScheduleActionInFlight(false);
    }
  };

  return (
    <Section
      title="Schedules"
      subtitle="Repeatable jobs"
      actions={
        <div className="filters">
          <div className="stack" style={{ minWidth: 260, flex: "1 1 320px" }}>
            <input
              className="input"
              value={scheduleName}
              onChange={(event) => setScheduleName(event.target.value)}
              placeholder="Queue name"
              aria-label="Schedule queue name"
            />
            <input
              className="input"
              value={scheduleCron}
              onChange={(event) => setScheduleCron(event.target.value)}
              placeholder="* * * * *"
              aria-label="Schedule cron expression"
            />
            <textarea
              className="input"
              value={scheduleData}
              onChange={(event) => setScheduleData(event.target.value)}
              placeholder='Optional JSON data (for example: {"foo":"bar"})'
              aria-label="Schedule JSON data"
              style={{ minHeight: 92, height: "auto", resize: "vertical" }}
            />
          </div>
          <button
            type="button"
            className="button"
            disabled={
              !actionsEnabled ||
              scheduleActionInFlight ||
              !scheduleName ||
              !scheduleCron
            }
            onClick={createSchedule}
          >
            Create schedule
          </button>
        </div>
      }
    >
      {actionState ? <div className="banner compact">{actionState}</div> : null}
      {schedules.length ? (
        <Table
          columns={["Name", "Cron", "Timezone", "Created", "Data", "Actions"]}
          rows={schedules.map((schedule: ScheduleInfo) => [
            schedule.name,
            schedule.cron ?? "—",
            schedule.tz ?? "—",
            <RelativeTime
              key={`${schedule.name}-created`}
              timestamp={schedule.created}
            />,
            <span className="mono" key={schedule.name}>
              {truncate(JSON.stringify(schedule.data ?? {}), 40)}
            </span>,
            <div className="filters" key={`${schedule.name}-actions`}>
              <button
                type="button"
                className="button"
                disabled={!actionsEnabled || scheduleActionInFlight}
                onClick={() => runNow(schedule.name)}
                title="Run this schedule once now without changing its cron cadence"
              >
                Run now
              </button>
              <button
                type="button"
                className="button danger"
                disabled={!actionsEnabled || scheduleActionInFlight}
                onClick={() => unschedule(schedule.name)}
              >
                Unschedule
              </button>
            </div>,
          ])}
        />
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="No schedules"
          description="Add a cron schedule to automatically enqueue jobs."
        />
      )}
    </Section>
  );
}

export const SchedulersPage = SchedulesPage;

export function DeadLetterPage() {
  const { data, isLoading, error } = useDeadLetter();
  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading dead-letter…" />;
  if (error)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Dead letter unavailable"
        description={error.message}
      />
    );
  const jobs = data?.items ?? [];
  const deadLetterCount = data?.total ?? 0;

  return (
    <Section title="Dead Letter" subtitle={`${deadLetterCount} failed jobs`}>
      <div className="stats-grid">
        <SummaryCard
          title="Dead-letter jobs"
          value={deadLetterCount.toLocaleString()}
          subtitle="Failed after retries"
          icon={CircleSlash2}
        />
        <SummaryCard
          title="Guidance"
          value="Inspect jobs"
          subtitle="Open a job to review its payload, output, and failure details."
          icon={AlertTriangle}
        />
      </div>
      {jobs.length ? (
        <Table
          columns={["ID", "Queue", "State", "Failure", "Created"]}
          rows={jobs.map((job: JobSummary) => [
            <Link
              key={job.id}
              to="/jobs/$jobId"
              params={{ jobId: job.id } as never}
              className="mono"
            >
              {truncate(job.id, 12)}
            </Link>,
            job.queue,
            <StatusBadge key={`${job.id}-state`} state={job.state} />,
            failureSnippetForJobSummary(job),
            <RelativeTime
              key={`${job.id}-created`}
              timestamp={job.createdOn}
            />,
          ])}
        />
      ) : (
        <EmptyState
          icon={CircleSlash2}
          title="Dead letter is empty"
          description="Failed jobs will appear here when pg-boss exhausts retries."
        />
      )}
    </Section>
  );
}

export function AlertsPage() {
  const { data, isLoading, error } = useAlerts();

  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading alerts…" />;
  if (error && !data)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Alerts unavailable"
        description={error.message}
      />
    );

  if (!data?.enabled || !data?.rules?.length) {
    return (
      <EmptyState
        icon={Bell}
        title="Alerts are config-driven"
        description="Alerting is read-only here. Configure rules and contact points in the host app, then refresh to review violations and delivery coverage."
      />
    );
  }

  const violations = (data.violations ?? []) as BossbenchAlertViolation[];
  const rules = data.rules ?? [];
  const contactPoints = data.contactPoints ?? [];

  return (
    <div className="section">
      <div className="stats-grid">
        <SummaryCard
          title="Current violations"
          value={violations.length}
          subtitle="Active rules that are firing"
          icon={AlertTriangle}
        />
        <SummaryCard
          title="Rules"
          value={rules.length}
          subtitle="Loaded from host config"
          icon={Bell}
        />
        <SummaryCard
          title="Contact points"
          value={contactPoints.length}
          subtitle="Configured delivery targets"
          icon={Inbox}
        />
        <SummaryCard
          title="Delivery"
          value={alertDeliveryStatus(data.delivery)}
          subtitle="Status not surfaced in the UI yet"
          icon={CircleSlash2}
        />
      </div>

      <Section title="Violations" subtitle="Rules currently above threshold">
        {violations.length ? (
          <Table
            wrapperClassName="jobs-table-scroll"
            tableClassName="jobs-table"
            columns={[
              "Rule",
              "Type",
              "Scope",
              "Current",
              "Threshold",
              "Severity",
              "Observed",
            ]}
            rows={violations.map((violation) => [
              <span className="mono" key={violation.ruleId}>
                {violation.ruleName}
              </span>,
              <span className="mono" key={`${violation.ruleId}-type`}>
                {violation.type}
              </span>,
              violation.queue ?? "All queues",
              formatAlertValue(violation.type, violation.current),
              formatAlertValue(violation.type, violation.threshold),
              violation.severity,
              <RelativeTime
                key={`${violation.ruleId}-observed`}
                timestamp={violation.observedAt}
              />,
            ])}
          />
        ) : (
          <EmptyState
            icon={Bell}
            title="No active violations"
            description="Rules are loaded and within threshold right now."
          />
        )}
      </Section>

      <Section title="Rules" subtitle={`${rules.length} configured rules`}>
        <Table
          wrapperClassName="jobs-table-scroll"
          tableClassName="jobs-table"
          columns={[
            "Name",
            "Type",
            "Scope",
            "Threshold",
            "Window",
            "Cooldown",
            "Severity",
            "Contact points",
          ]}
          rows={rules.map((rule: BossbenchAlertRule) => [
            <span className="mono" key={rule.id}>
              {rule.name}
            </span>,
            <span className="mono" key={`${rule.id}-type`}>
              {rule.type}
            </span>,
            alertScope(rule),
            formatAlertValue(rule.type, rule.threshold),
            rule.windowMinutes !== undefined ? `${rule.windowMinutes}m` : "—",
            rule.cooldownMinutes !== undefined
              ? `${rule.cooldownMinutes}m`
              : "—",
            rule.severity ?? "warning",
            rule.contactPointIds?.length
              ? rule.contactPointIds.join(", ")
              : "—",
          ])}
        />
      </Section>

      <Section
        title="Contact points"
        subtitle="Configured targets only; secrets stay in the host app"
      >
        {contactPoints.length ? (
          <Table
            wrapperClassName="jobs-table-scroll"
            tableClassName="jobs-table"
            columns={["ID", "Name", "Type", "Configured"]}
            rows={contactPoints.map((contactPoint) => [
              <span className="mono" key={contactPoint.id}>
                {contactPoint.id}
              </span>,
              contactPoint.name,
              <span className="mono" key={`${contactPoint.id}-type`}>
                {contactPoint.type}
              </span>,
              contactPoint.configured ? "Yes" : "No",
            ])}
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title="No contact points configured"
            description="Add destinations in the host app to enable delivery later."
          />
        )}
      </Section>
    </div>
  );
}

export function WarningsPage() {
  const { data, isLoading, error } = useWarnings();
  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading warnings…" />;
  if (error)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Warnings unavailable"
        description={error.message}
      />
    );
  const warnings = data?.items ?? [];

  if (!warnings.length) {
    return (
      <EmptyState
        icon={Bell}
        title="No warnings"
        description="Schema and runtime warnings will appear here when the dashboard detects issues. If you expect persistent warnings, confirm pg-boss is configured with persistWarnings."
      />
    );
  }

  return (
    <Section title="Warnings" subtitle={`${warnings.length} warnings`}>
      <Table
        columns={["Created", "Type", "Detail"]}
        rows={warnings.map((warning: WarningInfo) => [
          <RelativeTime
            key={`${warning.id}-created`}
            timestamp={warning.createdOn}
          />,
          warning.name,
          <span className="mono" key={warning.id}>
            {truncate(JSON.stringify(warning.detail ?? {}), 80)}
          </span>,
        ])}
      />
    </Section>
  );
}

function Bars({
  items,
  palette,
}: {
  items: Array<{ label: string; value: number }>;
  palette: string;
}) {
  const max = items.reduce((largest, item) => Math.max(largest, item.value), 0);

  return (
    <div className="stack bars">
      {items.map((item) => (
        <div className="bar" key={item.label}>
          <span className="muted mono">{item.label}</span>
          <div className="track">
            <div
              className={`fill ${palette}`}
              style={{
                width: `${scaleValue(item.value, max)}%`,
              }}
            />
          </div>
          <strong className="mono">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function formatBucketLabel(bucket: string) {
  return new Date(bucket).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sortNullableDesc(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function ThroughputPanel({ buckets }: { buckets: MetricPoint[] }) {
  const recentBuckets = buckets.slice(0, 12).slice().reverse();
  const max = recentBuckets.reduce(
    (largest, bucket) => Math.max(largest, bucket.completed + bucket.failed),
    0,
  );

  return (
    <div className="metrics-chart">
      {recentBuckets.map((bucket) => {
        const completed = bucket.completed;
        const failed = bucket.failed;
        const total = completed + failed;

        return (
          <div className="metrics-chart-row" key={bucket.bucket}>
            <div className="metrics-chart-label">
              <span className="mono">{formatBucketLabel(bucket.bucket)}</span>
              <span className="muted">{total} jobs</span>
            </div>
            <div className="metrics-chart-track">
              <div className="metrics-chart-bars">
                <div
                  className="metrics-chart-fill success"
                  style={{ width: `${scaleValue(completed, max)}%` }}
                  title={`Completed ${completed}`}
                />
                <div
                  className="metrics-chart-fill danger"
                  style={{ width: `${scaleValue(failed, max)}%` }}
                  title={`Failed ${failed}`}
                />
              </div>
            </div>
            <div className="metrics-chart-values mono">
              <span>{completed} completed</span>
              <span>{failed} failed</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LatencyPanel({ buckets }: { buckets: MetricPoint[] }) {
  const recentBuckets = buckets.slice(0, 12).slice().reverse();
  const max = recentBuckets.reduce((largest, bucket) => {
    return Math.max(largest, bucket.avgDurationMs ?? 0, bucket.avgWaitMs ?? 0);
  }, 0);

  return (
    <div className="metrics-chart metrics-chart--latency">
      {recentBuckets.map((bucket) => (
        <div className="metrics-latency-row" key={bucket.bucket}>
          <div className="metrics-chart-label">
            <span className="mono">{formatBucketLabel(bucket.bucket)}</span>
            <span className="muted">
              {(bucket.completed + bucket.failed).toLocaleString()} jobs
            </span>
          </div>
          <div className="metrics-latency-bars">
            <div className="metrics-meter">
              <div className="metrics-meter-head">
                <span>Duration</span>
                <strong className="mono">
                  {formatDurationMs(bucket.avgDurationMs)}
                </strong>
              </div>
              <div className="metrics-meter-track">
                <div
                  className="metrics-meter-fill"
                  style={{
                    width: `${scaleValue(bucket.avgDurationMs ?? 0, max)}%`,
                  }}
                />
              </div>
            </div>
            <div className="metrics-meter">
              <div className="metrics-meter-head">
                <span>Wait</span>
                <strong className="mono">
                  {formatDurationMs(bucket.avgWaitMs)}
                </strong>
              </div>
              <div className="metrics-meter-track">
                <div
                  className="metrics-meter-fill success"
                  style={{
                    width: `${scaleValue(bucket.avgWaitMs ?? 0, max)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricsDashboard({
  metrics,
  errorMessage,
}: {
  metrics: MetricsResponse;
  errorMessage: string | undefined;
}) {
  const buckets = metrics.buckets ?? [];
  const queues = metrics.queues ?? [];
  const hasBuckets = buckets.length > 0;
  const hasQueues = queues.length > 0;
  const slowestQueues = useMemo(
    () =>
      [...queues].sort(
        (left, right) =>
          sortNullableDesc(left.avgDurationMs, right.avgDurationMs) ||
          left.name.localeCompare(right.name),
      ),
    [queues],
  );
  const failingQueues = useMemo(
    () =>
      [...queues].sort((left, right) => {
        if (right.failed !== left.failed) return right.failed - left.failed;
        if (right.errorRate !== left.errorRate)
          return right.errorRate - left.errorRate;
        return left.name.localeCompare(right.name);
      }),
    [queues],
  );

  return (
    <div className="section metrics-dashboard">
      {errorMessage ? (
        <div className="banner compact metrics-banner">{errorMessage}</div>
      ) : null}
      <div className="stats-grid metrics-summary-grid">
        <SummaryCard
          title="Throughput"
          value={metrics.summary.throughputPerHour.toFixed(1)}
          subtitle="jobs/hour"
          icon={BarChart3}
          className="metrics-summary-card"
        />
        <SummaryCard
          title="Error Rate"
          value={formatPercent(metrics.summary.errorRate)}
          subtitle={`${metrics.summary.totalFailed} failed`}
          icon={Percent}
          className="metrics-summary-card"
        />
        <SummaryCard
          title="Avg Duration"
          value={formatDurationMs(metrics.summary.avgDurationMs)}
          subtitle="pg-boss execution time"
          icon={Clock3}
          className="metrics-summary-card"
        />
        <SummaryCard
          title="Avg Wait"
          value={formatDurationMs(metrics.summary.avgWaitMs)}
          subtitle="queued before start"
          icon={Clock3}
          className="metrics-summary-card"
        />
      </div>

      {!hasBuckets && !hasQueues ? (
        <EmptyState
          icon={SquareActivity}
          title="No metrics yet"
          description="pg-boss has not produced hourly buckets or queue-level metrics for this window."
        />
      ) : (
        <div className="metrics-layout">
          <Section
            title="Throughput"
            subtitle="Completed and failed jobs by hour"
            actions={<span className="muted">Last 12 hours</span>}
          >
            {hasBuckets ? (
              <ThroughputPanel buckets={buckets} />
            ) : (
              <div className="metrics-empty muted">
                No bucketed throughput data is available yet.
              </div>
            )}
          </Section>

          <Section
            title="Duration and wait"
            subtitle="Average execution and queue wait by hour"
            actions={<span className="muted">Last 12 hours</span>}
          >
            {hasBuckets ? (
              <LatencyPanel buckets={buckets} />
            ) : (
              <div className="metrics-empty muted">
                No latency data is available yet.
              </div>
            )}
          </Section>

          <Section title="Slowest queues" subtitle="Sorted by average duration">
            {hasQueues ? (
              <Table
                wrapperClassName="jobs-table-scroll"
                tableClassName="jobs-table metrics-table"
                columns={[
                  "Queue",
                  "Avg duration",
                  "Avg wait",
                  "Completed",
                  "Failed",
                ]}
                rows={slowestQueues.map((queue) => [
                  <Link
                    key={queue.name}
                    to="/queues/$queueName"
                    params={{ queueName: queue.name } as never}
                    className="mono"
                  >
                    {queue.name}
                  </Link>,
                  formatDurationMs(queue.avgDurationMs),
                  formatDurationMs(queue.avgWaitMs),
                  queue.completed.toLocaleString(),
                  queue.failed.toLocaleString(),
                ])}
              />
            ) : (
              <div className="metrics-empty muted">
                No queue-level metrics yet.
              </div>
            )}
          </Section>

          <Section
            title="Failing queues"
            subtitle="Sorted by failures, then error rate"
          >
            {hasQueues ? (
              <Table
                wrapperClassName="jobs-table-scroll"
                tableClassName="jobs-table metrics-table"
                columns={[
                  "Queue",
                  "Error rate",
                  "Failed",
                  "Completed",
                  "Retry",
                ]}
                rows={failingQueues.map((queue) => [
                  <Link
                    key={queue.name}
                    to="/queues/$queueName"
                    params={{ queueName: queue.name } as never}
                    className="mono"
                  >
                    {queue.name}
                  </Link>,
                  formatPercent(queue.errorRate),
                  queue.failed.toLocaleString(),
                  queue.completed.toLocaleString(),
                  queue.retry.toLocaleString(),
                ])}
              />
            ) : (
              <div className="metrics-empty muted">
                No queue-level metrics yet.
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

export function MetricsPage() {
  const { data, isLoading, error } = useMetrics();
  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading metrics…" />;
  if (error && !data)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Metrics unavailable"
        description={error.message}
      />
    );

  if (!data) return null;
  return <MetricsDashboard metrics={data} errorMessage={error?.message} />;
}

export function ActivityPage() {
  const { data, isLoading, error } = useActivity();
  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading activity…" />;
  if (error)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Activity unavailable"
        description={error.message}
      />
    );
  const items = (data?.items ?? []) as ActivityPoint[];

  if (!items.length) {
    return (
      <EmptyState
        icon={SquareActivity}
        title="No activity yet"
        description="Activity will appear once jobs start moving through pg-boss."
      />
    );
  }

  return (
    <Section title="Activity" subtitle="Job activity over time">
      <Bars
        palette="success"
        items={items.slice(0, 12).map((bucket) => ({
          label: new Date(bucket.bucket).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          value: bucket.created + bucket.completed + bucket.failed,
        }))}
      />
    </Section>
  );
}

export function SettingsPage() {
  const { data } = useConfig();
  const tags = data?.tags ?? [];
  const shortcuts = [
    ["Cmd/Ctrl + K", "Open command palette"],
    ["Cmd/Ctrl + R", "Refresh dashboard"],
    ["Cmd/Ctrl + Shift + T", "Toggle theme"],
  ] as const;
  return (
    <div className="section">
      <div className="stats-grid">
        <SummaryCard
          title="Schema"
          value={data?.schema ?? "pgboss"}
          subtitle="Database schema"
        />
        <SummaryCard
          title="Readonly"
          value={data?.readonly ? "Yes" : "No"}
          subtitle={data?.readonly ? "Browse-only" : "Actions enabled"}
        />
        <SummaryCard
          title="Has Boss"
          value={data?.hasBoss ? "Yes" : "No"}
          subtitle="Connected instance"
        />
        <SummaryCard
          title="Tags"
          value={tags.length}
          subtitle="Configured tag fields"
        />
      </div>
      <Section title="Tags" subtitle="Available tag fields">
        <div className="stack">
          {tags.length ? (
            tags.map((tag: string) => (
              <span key={tag} className="mono">
                {tag}
              </span>
            ))
          ) : (
            <div className="muted">No tag fields configured.</div>
          )}
        </div>
      </Section>
      <Section title="Auth guidance" subtitle="How access is controlled">
        <div className="muted">
          Bossbench mirrors the host app’s auth and embed mode. If readonly or
          no pg-boss instance is attached, the dashboard is browse-only.
        </div>
      </Section>
      <Section title="Keyboard shortcuts" subtitle="Fast actions from anywhere">
        <div className="shortcut-list">
          {shortcuts.map(([keys, label]) => (
            <div key={keys} className="shortcut-row">
              <kbd>{keys}</kbd>
              <span className="muted">{label}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

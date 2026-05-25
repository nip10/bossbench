import { Link, useParams } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CircleSlash2,
  Database,
  Inbox,
  LoaderCircle,
  SearchX,
  SquareActivity,
} from "lucide-react";
import { isValidElement, type ReactNode, useState } from "react";
import type {
  ActivityPoint,
  JobDetail,
  JobSummary,
  MetricPoint,
  OverviewStats,
  QueueInfo,
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
import { api } from "./lib/api";
import {
  useActivity,
  useConfig,
  useDeadLetter,
  useJob,
  useJobs,
  useMetrics,
  useOverview,
  useQueue,
  useQueues,
  useSchedules,
  useWarnings,
} from "./lib/hooks";
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
}: {
  columns: ReactNode[];
  rows: ReactNode[][];
}) {
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={nodeKey(column)}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {row.map((cell, cellIndex) => (
              <td key={cellKey(row, cell, cellIndex)}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
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

export function OverviewPage() {
  const { data, isLoading, error } = useOverview();
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
  const totalJobs = Object.values(overview.totals).reduce(
    (sum: number, value: number) => sum + value,
    0,
  );

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
  const { data, isLoading, error } = useQueue(params.queueName);
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
      <Section title={data.name} subtitle="Recent jobs">
        {data.recentJobs.length ? (
          <Table
            columns={["Job", "State", "Created", "Completed", "Priority"]}
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

export function RunsPage() {
  const { searchQuery, setSearchQuery } = useDashboardSearch();
  const [state, setState] = useState<string>("all");
  const [sort, setSort] = useState<string | undefined>("created_on:desc");
  const currentSort = parseSort(sort);
  const filters = {
    ...(searchQuery ? { q: searchQuery } : {}),
    ...(state === "all" ? {} : { state }),
    limit: 100,
    ...(sort ? { sort } : {}),
  };
  const { data, isLoading, error } = useJobs(filters);
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
  const rows = data?.items ?? [];

  return (
    <Section
      title="Jobs"
      subtitle={`${data?.total ?? 0} matched`}
      actions={
        <SmartSearch
          value={searchQuery}
          onValueChange={setSearchQuery}
          state={state}
          onStateChange={setState}
          placeholder="Search jobs…"
          states={[
            { value: "all", label: "All states" },
            { value: "created", label: "Created" },
            { value: "retry", label: "Retry" },
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
            { value: "failed", label: "Failed" },
          ]}
        />
      }
    >
      <Table
        columns={[
          "ID",
          <SortableHeader
            key="name"
            field="name"
            label="Queue"
            currentSort={currentSort}
            onSort={(field, direction) =>
              setSort(
                field && direction ? createSort(field, direction) : undefined,
              )
            }
          />,
          <SortableHeader
            key="state"
            field="state"
            label="State"
            currentSort={currentSort}
            onSort={(field, direction) =>
              setSort(
                field && direction ? createSort(field, direction) : undefined,
              )
            }
          />,
          <SortableHeader
            key="created_on"
            field="created_on"
            label="Created"
            currentSort={currentSort}
            onSort={(field, direction) =>
              setSort(
                field && direction ? createSort(field, direction) : undefined,
              )
            }
          />,
          <SortableHeader
            key="completed_on"
            field="completed_on"
            label="Completed"
            currentSort={currentSort}
            onSort={(field, direction) =>
              setSort(
                field && direction ? createSort(field, direction) : undefined,
              )
            }
          />,
          <SortableHeader
            key="priority"
            field="priority"
            label="Priority"
            currentSort={currentSort}
            onSort={(field, direction) =>
              setSort(
                field && direction ? createSort(field, direction) : undefined,
              )
            }
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
            searchQuery || state !== "all"
              ? "Relax the search or state filter to find more jobs."
              : "No jobs have been recorded yet."
          }
        />
      ) : null}
    </Section>
  );
}

export function JobPage() {
  const params = useParams({ strict: false }) as { jobId: string };
  const { data: config } = useConfig();
  const { data, isLoading, error } = useJob(params.jobId);
  const [actionState, setActionState] = useState<string | null>(null);
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

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    setActionState(`${label}…`);
    try {
      await action();
      setActionState(`${label} complete. Refreshing…`);
      window.setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setActionState(
        error instanceof Error ? error.message : `${label} failed`,
      );
    }
  };

  return (
    <div className="detail-grid">
      <Section
        title={job.name}
        subtitle={job.id}
        actions={
          <div className="filters">
            <StatusBadge state={job.state} />
            <button
              type="button"
              className="button"
              disabled={!actionsEnabled}
              onClick={() => runAction("Retry", () => api.retryJob(job.id))}
            >
              Retry
            </button>
            <button
              type="button"
              className="button"
              disabled={!actionsEnabled}
              onClick={() => runAction("Cancel", () => api.cancelJob(job.id))}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button"
              disabled={!actionsEnabled}
              onClick={() => runAction("Resume", () => api.resumeJob(job.id))}
            >
              Resume
            </button>
            <button
              type="button"
              className="button danger"
              disabled={!actionsEnabled}
              onClick={() => runAction("Delete", () => api.deleteJob(job.id))}
            >
              Delete
            </button>
          </div>
        }
      >
        {actionState ? (
          <div className="banner compact">{actionState}</div>
        ) : null}
        <Table
          columns={["Field", "Value"]}
          rows={[
            ["Queue", job.queue],
            ["State", <StatusBadge key="state" state={job.state} />],
            [
              "Created",
              <RelativeTime key="created" timestamp={job.createdOn} />,
            ],
            [
              "Started",
              <RelativeTime key="started" timestamp={job.startedOn} />,
            ],
            [
              "Completed",
              <RelativeTime key="completed" timestamp={job.completedOn} />,
            ],
            ["Priority", job.priority ?? "—"],
            ["Retry Count", job.retryCount ?? "—"],
            ["Retry Limit", job.retryLimit ?? "—"],
            ["Singleton Key", job.singletonKey ?? "—"],
            ["Expires In", job.expireInSeconds ?? "—"],
          ]}
        />
      </Section>
      <Section title="Payload" subtitle="JSON data">
        <JsonViewer data={job.data} />
      </Section>
      <Section title="Output" subtitle="Task result">
        <JsonViewer data={job.output ?? null} defaultExpanded={false} />
      </Section>
      <Section title="Raw" subtitle="Repository payload">
        <JsonViewer data={job.raw} defaultExpanded={false} />
      </Section>
    </div>
  );
}

export function SchedulersPage() {
  const { data, isLoading, error } = useSchedules();
  const { data: config } = useConfig();
  const [actionState, setActionState] = useState<string | null>(null);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleCron, setScheduleCron] = useState("");
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
    setActionState(`Scheduling ${scheduleName}…`);
    try {
      await api.createSchedule({ name: scheduleName, cron: scheduleCron });
      setActionState("Schedule created. Refreshing…");
      window.setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setActionState(
        error instanceof Error ? error.message : "Schedule failed",
      );
    }
  };

  const unschedule = async (name: string) => {
    setActionState(`Unscheduling ${name}…`);
    try {
      await api.unschedule(name);
      setActionState("Unschedule complete. Refreshing…");
      window.setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setActionState(
        error instanceof Error ? error.message : "Unschedule failed",
      );
    }
  };

  return (
    <Section
      title="Schedules"
      subtitle="Repeatable jobs"
      actions={
        <div className="filters">
          <input
            className="input"
            value={scheduleName}
            onChange={(event) => setScheduleName(event.target.value)}
            placeholder="Queue name"
          />
          <input
            className="input"
            value={scheduleCron}
            onChange={(event) => setScheduleCron(event.target.value)}
            placeholder="* * * * *"
          />
          <button
            type="button"
            className="button"
            disabled={!actionsEnabled || !scheduleName || !scheduleCron}
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
            <button
              type="button"
              className="button"
              key={`${schedule.name}-unschedule`}
              disabled={!actionsEnabled}
              onClick={() => unschedule(schedule.name)}
            >
              Unschedule
            </button>,
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

  if (!jobs.length) {
    return (
      <EmptyState
        icon={CircleSlash2}
        title="Dead letter is empty"
        description="Failed jobs will appear here when pg-boss exhausts retries."
      />
    );
  }

  return (
    <Section title="Dead Letter" subtitle={`${data?.total ?? 0} failed jobs`}>
      <Table
        columns={["ID", "Queue", "State", "Created"]}
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
          <RelativeTime key={`${job.id}-created`} timestamp={job.createdOn} />,
        ])}
      />
    </Section>
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
        description="Schema and runtime warnings will appear here when the dashboard detects issues."
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
  return (
    <div className="stack">
      {items.map((item) => (
        <div className="bar" key={item.label}>
          <span className="muted mono">{item.label}</span>
          <div className="track">
            <div
              className={`fill ${palette}`}
              style={{
                width: `${Math.max(8, Math.min(100, item.value * 10))}%`,
              }}
            />
          </div>
          <strong className="mono">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function MetricsPage() {
  const { data, isLoading, error } = useMetrics();
  if (isLoading && !data)
    return <EmptyState icon={LoaderCircle} title="Loading metrics…" />;
  if (error)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Metrics unavailable"
        description={error.message}
      />
    );
  const buckets = (data?.buckets ?? []) as MetricPoint[];
  const totals = buckets.reduce(
    (acc, bucket) => ({
      created: acc.created + bucket.created,
      completed: acc.completed + bucket.completed,
      failed: acc.failed + bucket.failed,
      retry: acc.retry + bucket.retry,
    }),
    { created: 0, completed: 0, failed: 0, retry: 0 },
  );

  return (
    <Section
      title="Metrics"
      subtitle="Created / completed / failed / retry"
      actions={<span className="muted">24h buckets</span>}
    >
      <div className="stats-grid">
        <SummaryCard
          title="Created"
          value={totals.created}
          icon={SquareActivity}
        />
        <SummaryCard
          title="Completed"
          value={totals.completed}
          icon={Database}
        />
        <SummaryCard title="Failed" value={totals.failed} icon={CircleSlash2} />
        <SummaryCard title="Retry" value={totals.retry} icon={Bell} />
      </div>
      <Bars
        palette=""
        items={buckets.slice(0, 12).map((bucket) => ({
          label: new Date(bucket.bucket).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          value:
            bucket.created + bucket.completed + bucket.failed + bucket.retry,
        }))}
      />
    </Section>
  );
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
    </div>
  );
}

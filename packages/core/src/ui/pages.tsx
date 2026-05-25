import { Link, useParams } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import type {
  ActivityPoint,
  JobSummary,
  MetricPoint,
  OverviewStats,
  QueueInfo,
  ScheduleInfo,
  WarningInfo,
} from "../core/types";
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
import { formatRelativeTime, truncate } from "./lib/utils";
import { useDashboardSearch } from "./router";

function Section({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
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
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {row.map((cell, cellIndex) => (
              <td key={columns[cellIndex]}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function rowKey(row: React.ReactNode[]) {
  for (const cell of row) {
    if (typeof cell === "string" || typeof cell === "number")
      return String(cell);
  }
  return row.length.toString();
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="hint">{hint}</div>
    </div>
  );
}

function StatePill({ state }: { state: string }) {
  return <span className={`state ${state}`}>{state}</span>;
}

function Empty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {description ? <div className="muted">{description}</div> : null}
    </div>
  );
}

export function OverviewPage() {
  const { data, isLoading, error } = useOverview();
  if (isLoading && !data) return <div className="empty">Loading overview…</div>;
  if (error)
    return (
      <Empty title="Failed to load overview" description={error.message} />
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
        <Stat
          label="Total Jobs"
          value={totalJobs.toLocaleString()}
          hint="Across all states"
        />
        <Stat
          label="Failed / Dead Letter"
          value={overview.deadLetter.toLocaleString()}
          hint="Needs attention"
        />
        <Stat
          label="Warnings"
          value={overview.warnings.toLocaleString()}
          hint="Schema or runtime"
        />
        <Stat
          label="Queues"
          value={overview.queues.length.toLocaleString()}
          hint="Configured queues"
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
  if (isLoading && !data) return <div className="empty">Loading queues…</div>;
  if (error)
    return <Empty title="Queues unavailable" description={error.message} />;
  const queues = data ?? [];

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
  if (isLoading && !data) return <div className="empty">Loading queue…</div>;
  if (error || !data)
    return (
      <Empty
        title="Queue unavailable"
        description={error?.message ?? "Not found"}
      />
    );

  return (
    <div className="section">
      <div className="stats-grid">
        <Stat label="Total" value={data.total} hint="All jobs" />
        <Stat label="Active" value={data.active} hint="Processing" />
        <Stat label="Failed" value={data.failed} hint="Needs attention" />
        <Stat label="Completed" value={data.completed} hint="Finished" />
      </div>
      <Section title={data.name} subtitle="Recent jobs">
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
            <StatePill key={`${job.id}-state`} state={job.state} />,
            formatRelativeTime(job.createdOn),
            formatRelativeTime(job.completedOn),
            job.priority ?? "—",
          ])}
        />
      </Section>
    </div>
  );
}

export function RunsPage() {
  const { searchQuery } = useDashboardSearch();
  const [state, setState] = useState<string>("all");
  const filters = {
    ...(searchQuery ? { q: searchQuery } : {}),
    ...(state === "all" ? {} : { state }),
    limit: 100,
  };
  const { data, isLoading, error } = useJobs(filters);
  if (isLoading && !data) return <div className="empty">Loading jobs…</div>;
  if (error)
    return <Empty title="Jobs unavailable" description={error.message} />;
  const rows = data?.items ?? [];

  return (
    <Section
      title="Jobs"
      subtitle={`${data?.total ?? 0} matched`}
      actions={
        <>
          <input
            className="input"
            value={searchQuery}
            placeholder="Search jobs…"
            readOnly
          />
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="all">All states</option>
            <option value="created">Created</option>
            <option value="retry">Retry</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
          </select>
        </>
      }
    >
      <Table
        columns={[
          "ID",
          "Name",
          "Queue",
          "State",
          "Created",
          "Completed",
          "Priority",
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
          job.name,
          job.queue,
          <StatePill key={`${job.id}-state`} state={job.state} />,
          formatRelativeTime(job.createdOn),
          formatRelativeTime(job.completedOn),
          job.priority ?? "—",
        ])}
      />
    </Section>
  );
}

export function JobPage() {
  const params = useParams({ strict: false }) as { jobId: string };
  const { data: config } = useConfig();
  const { data, isLoading, error } = useJob(params.jobId);
  const [actionState, setActionState] = useState<string | null>(null);
  if (isLoading && !data) return <div className="empty">Loading job…</div>;
  if (error || !data)
    return (
      <Empty
        title="Job unavailable"
        description={error?.message ?? "Not found"}
      />
    );
  const job = data as JobSummary & {
    retryCount?: number;
    retryLimit?: number | null;
  };
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
            <StatePill state={job.state} />
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
            ["State", job.state],
            ["Created", formatRelativeTime(job.createdOn)],
            ["Started", formatRelativeTime(job.startedOn)],
            ["Completed", formatRelativeTime(job.completedOn)],
            ["Priority", job.priority ?? "—"],
            ["Retry Count", job.retryCount ?? "—"],
            ["Retry Limit", job.retryLimit ?? "—"],
          ]}
        />
      </Section>
      <Section title="Payload" subtitle="JSON data">
        <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(job.data, null, 2)}
        </pre>
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
    return <div className="empty">Loading schedules…</div>;
  if (error)
    return <Empty title="Schedules unavailable" description={error.message} />;
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
      <Table
        columns={["Name", "Cron", "Timezone", "Created", "Data", "Actions"]}
        rows={schedules.map((schedule: ScheduleInfo) => [
          schedule.name,
          schedule.cron ?? "—",
          schedule.tz ?? "—",
          formatRelativeTime(schedule.created),
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
    </Section>
  );
}

export function DeadLetterPage() {
  const { data, isLoading, error } = useDeadLetter();
  if (isLoading && !data)
    return <div className="empty">Loading dead-letter…</div>;
  if (error)
    return (
      <Empty title="Dead letter unavailable" description={error.message} />
    );
  const jobs = data?.items ?? [];

  return (
    <Section title="Dead Letter" subtitle={`${data?.total ?? 0} failed jobs`}>
      <Table
        columns={["ID", "Name", "Queue", "State", "Created"]}
        rows={jobs.map((job: JobSummary) => [
          <Link
            key={job.id}
            to="/jobs/$jobId"
            params={{ jobId: job.id } as never}
            className="mono"
          >
            {truncate(job.id, 12)}
          </Link>,
          job.name,
          job.queue,
          <StatePill key={`${job.id}-state`} state={job.state} />,
          formatRelativeTime(job.createdOn),
        ])}
      />
    </Section>
  );
}

export function WarningsPage() {
  const { data, isLoading, error } = useWarnings();
  if (isLoading && !data) return <div className="empty">Loading warnings…</div>;
  if (error)
    return <Empty title="Warnings unavailable" description={error.message} />;
  const warnings = data?.items ?? [];

  return (
    <Section title="Warnings" subtitle={`${warnings.length} warnings`}>
      <Table
        columns={["Created", "Type", "Detail"]}
        rows={warnings.map((warning: WarningInfo) => [
          formatRelativeTime(warning.createdOn),
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
  if (isLoading && !data) return <div className="empty">Loading metrics…</div>;
  if (error)
    return <Empty title="Metrics unavailable" description={error.message} />;
  const buckets = (data?.buckets ?? []) as MetricPoint[];

  return (
    <Section
      title="Metrics"
      subtitle="Created / completed / failed / retry"
      actions={<span className="muted">24h buckets</span>}
    >
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
  if (isLoading && !data) return <div className="empty">Loading activity…</div>;
  if (error)
    return <Empty title="Activity unavailable" description={error.message} />;
  const items = (data?.items ?? []) as ActivityPoint[];

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
        <Stat
          label="Schema"
          value={data?.schema ?? "pgboss"}
          hint="Database schema"
        />
        <Stat
          label="Readonly"
          value={data?.readonly ? "Yes" : "No"}
          hint={data?.readonly ? "Browse-only" : "Actions enabled"}
        />
        <Stat
          label="Has Boss"
          value={data?.hasBoss ? "Yes" : "No"}
          hint="Connected instance"
        />
        <Stat label="Tags" value={tags.length} hint="Configured tag fields" />
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

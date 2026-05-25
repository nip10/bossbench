import {
  Activity,
  BarChart3,
  Clock,
  Layers,
  Search,
  Settings,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

const queues = ["email", "billing", "webhooks", "image-processing"];

function Frame({
  subtitle,
  children,
  active,
}: {
  subtitle: string;
  children: ReactNode;
  active: string;
}) {
  return (
    <div className="mockup-frame">
      <div className="mockup-titlebar">
        <div className="mockup-dots">
          <span className="mockup-dot bg-[#ff5f57]" />
          <span className="mockup-dot bg-[#febc2e]" />
          <span className="mockup-dot bg-[#28c840]" />
        </div>
        <div className="font-mono text-[10px] text-(--mock-fg-5)">
          {subtitle}
        </div>
        <div className="flex items-center gap-2 text-(--mock-fg-5)">
          <Search className="icon small" />
          <Settings className="icon small" />
        </div>
      </div>
      <div className="mockup-shell">
        <aside className="mockup-sidebar">
          <h4>Queues</h4>
          {queues.map((queue, index) => (
            <div
              key={queue}
              className={`mockup-nav-item ${index === 2 ? "active" : ""}`}
            >
              <span className="font-mono">{queue}</span>
              <span className="font-mono text-[10px]">
                {[12, 4, 47, 3][index]}
              </span>
            </div>
          ))}
          <h4 className="mt-4">Views</h4>
          {(
            [
              [BarChart3, "Overview"],
              [Activity, "Jobs"],
              [Layers, "Schedules"],
              [Clock, "Metrics"],
              [Zap, "Warnings"],
            ] as Array<[typeof BarChart3, string]>
          ).map(([Icon, label], index) => (
            <div
              key={String(label)}
              className={`mockup-nav-item ${active === label ? "active" : ""}`}
            >
              <span className="flex items-center gap-2">
                <Icon className="icon small" />
                <span>{label}</span>
              </span>
              {index === 0 ? (
                <span className="font-mono text-[10px]">live</span>
              ) : null}
            </div>
          ))}
        </aside>
        <div className="mockup-body">{children}</div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="mockup-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

function Table({
  rows,
}: {
  rows: Array<[string, string, string, string, string]>;
}) {
  return (
    <table className="mockup-table">
      <thead>
        <tr>
          <th>Job</th>
          <th>State</th>
          <th>Created</th>
          <th>Queue</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([job, state, created, queue, priority]) => (
          <tr key={`${job}-${created}`}>
            <td>{job}</td>
            <td>
              <span className={`state-pill ${state.toLowerCase()}`}>
                {state}
              </span>
            </td>
            <td>{created}</td>
            <td>{queue}</td>
            <td>{priority}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bars() {
  const items = [
    ["completed", 94],
    ["failed", 12],
    ["retry", 34],
    ["active", 18],
  ] as const;
  return (
    <div className="mockup-bars">
      {items.map(([label, value]) => (
        <div className="mockup-bar" key={label}>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-(--mock-fg-5)">
            {label}
          </span>
          <div className="mockup-track">
            <div
              className={`mockup-fill ${label === "completed" ? "success" : label === "failed" ? "warning" : ""}`}
              style={{ width: `${Math.max(8, Math.min(100, value))}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-(--mock-fg-3)">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function OverviewMockup() {
  return (
    <Frame subtitle="pgboss://postgres@localhost · 4 queues" active="Overview">
      <div className="mockup-card-grid">
        <Stat label="Jobs read" value="184,392" sub="last 24h" />
        <Stat label="Failed" value="287" sub="needs attention" />
        <Stat label="Active" value="47" sub="processing now" />
        <Stat label="Queues" value="4" sub="configured" />
      </div>
      <div className="mockup-panel">
        <Bars />
      </div>
    </Frame>
  );
}

export function JobsMockup() {
  const rows: Array<[string, string, string, string, string]> = [
    ["send-receipt", "completed", "now", "billing", "0"],
    ["reconcile-invoice", "active", "12s", "billing", "1"],
    ["resize-thumbnail", "retry", "1m", "image-processing", "2"],
    ["deliver-webhook", "failed", "4m", "webhooks", "3"],
    ["cleanup-cache", "cancelled", "8m", "email", "1"],
  ];
  return (
    <Frame subtitle="jobs · last 50" active="Jobs">
      <Table rows={rows} />
      <div className="mockup-panel mt-3">
        <Bars />
      </div>
    </Frame>
  );
}

export function SchedulersMockup() {
  return (
    <Frame subtitle="schedules · repeatable + delayed" active="Schedules">
      <div className="mockup-card-grid">
        <Stat label="Repeatable" value="18" sub="cron jobs" />
        <Stat label="Delayed" value="6" sub="scheduled" />
        <Stat label="Timezone" value="UTC" sub="default" />
        <Stat label="Warnings" value="1" sub="read-only" />
      </div>
      <div className="mockup-panel mt-3">
        <Bars />
      </div>
    </Frame>
  );
}

export function MetricsMockup() {
  return (
    <Frame subtitle="metrics · 24h" active="Metrics">
      <div className="mockup-card-grid">
        <Stat label="Completed" value="9.4k" sub="+12%" />
        <Stat label="Failed" value="34" sub="-3%" />
        <Stat label="Retry" value="112" sub="stable" />
        <Stat label="Activity" value="6.7k" sub="events" />
      </div>
      <div className="mockup-panel mt-3">
        <Bars />
      </div>
    </Frame>
  );
}

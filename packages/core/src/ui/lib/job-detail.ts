import type { JobDetail } from "../../core/types";

export type JobTimelineEvent = {
  kind:
    | "created"
    | "scheduled"
    | "started"
    | "completed"
    | "retry"
    | "dead-letter"
    | "state";
  title: string;
  description: string;
  timestamp: string | null;
  display: "timeline" | "context";
};

export function stringifyForClipboard(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  return json === undefined ? String(value) : json;
}

export function jobExportFilename(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `bossbench-job-${safe || "job"}.json`;
}

export function buildJobExport(job: JobDetail) {
  return {
    exportedBy: "Bossbench",
    exportedAt: new Date().toISOString(),
    job: {
      ...job,
      deadLetter: job.deadLetter ?? null,
    },
  };
}

export function buildJobTimeline(job: JobDetail): JobTimelineEvent[] {
  const events: JobTimelineEvent[] = [];

  if (job.createdOn) {
    events.push({
      kind: "created",
      title: "Created",
      description: `Job was inserted into queue ${job.queue}.`,
      timestamp: job.createdOn,
      display: "timeline",
    });
  }

  if (job.startAfter) {
    events.push({
      kind: "scheduled",
      title: "Scheduled for future start",
      description: "pg-boss will not make this job eligible before this time.",
      timestamp: job.startAfter,
      display: "timeline",
    });
  }

  if (job.startedOn) {
    events.push({
      kind: "started",
      title: "Started",
      description: "A worker started processing this job.",
      timestamp: job.startedOn,
      display: "timeline",
    });
  }

  if (job.completedOn) {
    events.push({
      kind: "completed",
      title: terminalTitle(job.state),
      description: terminalDescription(job.state),
      timestamp: job.completedOn,
      display: "timeline",
    });
  }

  if (job.retryCount > 0) {
    events.push({
      kind: "retry",
      title: "Retries recorded",
      description: `Retry count ${job.retryCount}${job.retryLimit === null ? "" : ` of ${job.retryLimit}`}.`,
      timestamp: null,
      display: "context",
    });
  }

  if (job.deadLetter) {
    events.push({
      kind: "dead-letter",
      title: "Dead letter data present",
      description: "pg-boss recorded dead-letter metadata for this job.",
      timestamp: null,
      display: "context",
    });
  }

  if (!job.completedOn && !job.startedOn && !job.startAfter && !job.createdOn) {
    events.push({
      kind: "state",
      title: `Current state: ${job.state}`,
      description:
        "No timestamped lifecycle events are available for this job.",
      timestamp: null,
      display: "timeline",
    });
  }

  return events;
}

function terminalTitle(state: JobDetail["state"]) {
  if (state === "failed") return "Failed";
  if (state === "cancelled") return "Cancelled";
  if (state === "completed") return "Completed";
  return `State changed to ${state}`;
}

function terminalDescription(state: JobDetail["state"]) {
  if (state === "failed") return "Job reached a failed terminal state.";
  if (state === "cancelled") return "Job was cancelled.";
  if (state === "completed") return "Job completed processing.";
  return "Job has a completion timestamp in pg-boss.";
}

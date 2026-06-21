import type { JobDetail } from "../../core/types";

export type JobTimelineEvent = {
  kind:
    | "created"
    | "scheduled"
    | "started"
    | "completed"
    | "failure"
    | "retry"
    | "dead-letter"
    | "state";
  title: string;
  description: string;
  timestamp: string | null;
  display: "timeline" | "context";
};

export type JobOperationalContextTone = "neutral" | "warning" | "danger";

export type JobOperationalContextCard = {
  title: string;
  description: string;
  tone: JobOperationalContextTone;
};

export type JobOperationalContext = {
  cards: JobOperationalContextCard[];
  nextChecks: string[];
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

export function buildJobOperationalContext(
  job: JobDetail,
): JobOperationalContext {
  const cards: JobOperationalContextCard[] = [];
  const nextChecks: string[] = [];
  const hasOutput = hasDiagnosticValue(job.output);
  const hasDeadLetter = hasDeadLetterValue(job.deadLetter);
  const hasFailureContext =
    job.state === "failed" || !!job.failureSnippet || hasDeadLetter;

  if (hasFailureContext) {
    cards.push({
      title: "Failure",
      description:
        job.failureSnippet ??
        (job.state === "failed"
          ? "Job is failed, but no concise failure output is available."
          : "Failure-related metadata is available for inspection."),
      tone: job.state === "failed" ? "danger" : "warning",
    });
  }

  if (job.retryCount > 0 || job.state === "retry") {
    cards.push({
      title: "Retries",
      description: retryDescription(job.retryCount, job.retryLimit),
      tone: "warning",
    });
  }

  if (hasDeadLetter) {
    cards.push({
      title: "Dead letter",
      description:
        "Dead-letter metadata is present. Inspect Raw JSON for the full pg-boss row.",
      tone: "danger",
    });
  }

  if (hasOutput && (hasFailureContext || job.state === "retry")) {
    nextChecks.push(
      "Inspect Output JSON for the task result or error payload.",
    );
  }
  if (job.retryCount > 0 || job.state === "retry") {
    nextChecks.push("Compare retry count with the configured retry policy.");
  }
  if (hasDeadLetter) {
    nextChecks.push("Inspect Raw JSON for dead-letter metadata.");
  }
  if (job.state === "failed") {
    nextChecks.push(
      "Check worker and downstream service logs around the completion time.",
    );
  }

  return { cards, nextChecks: [...new Set(nextChecks)] };
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

  if (job.state === "failed" || job.failureSnippet) {
    events.push({
      kind: "failure",
      title: "Failure context",
      description:
        job.failureSnippet ??
        "Job is failed, but no concise failure output is available.",
      timestamp: null,
      display: "context",
    });
  }

  if (job.retryCount > 0) {
    events.push({
      kind: "retry",
      title: "Retries recorded",
      description: retryDescription(job.retryCount, job.retryLimit),
      timestamp: null,
      display: "context",
    });
  }

  if (hasDeadLetterValue(job.deadLetter)) {
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

function hasDiagnosticValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function hasDeadLetterValue(value: unknown) {
  return value !== null && value !== undefined;
}

function retryDescription(retryCount: number, retryLimit: number | null) {
  if (retryLimit === null) {
    return `${retryCount} retries recorded; retry limit is not available in this pg-boss row.`;
  }
  if (retryCount >= retryLimit) {
    return `${retryCount} of ${retryLimit} retries recorded; retry limit reached.`;
  }
  const remaining = retryLimit - retryCount;
  return `${retryCount} of ${retryLimit} retries recorded; ${remaining} ${
    remaining === 1 ? "retry remains" : "retries remain"
  }.`;
}

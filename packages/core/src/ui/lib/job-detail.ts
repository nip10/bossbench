import type { JobDetail } from "../../core/types";

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

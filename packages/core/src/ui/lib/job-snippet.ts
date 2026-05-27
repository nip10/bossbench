import type { JobSummary } from "../../core/types";
import { truncate } from "./utils";

export function failureSnippetForJobSummary(job: JobSummary) {
  if (job.state !== "failed" || !job.failureSnippet) return "—";
  return truncate(job.failureSnippet, 64);
}

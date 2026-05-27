export function futureJobsDefaultSort() {
  return "start_after:asc";
}

export function futureJobsSubtitle(
  total: number,
  pageStart: number,
  pageEnd: number,
) {
  const base = `${total.toLocaleString()} concrete jobs scheduled for later`;
  return total ? `${base} • ${pageStart}-${pageEnd}` : base;
}

export function futureJobsEmptyDescription(hasFilters: boolean) {
  return hasFilters
    ? "Relax the filters to find more future jobs."
    : "No concrete jobs are waiting for a future start_after time. Schedules are managed separately on the Schedules page.";
}

import { useQuery } from "@tanstack/react-query";
import type { QueryFilters } from "../../core/types";
import { api } from "./api";

export function normalizeJobsFilters(filters?: QueryFilters) {
  if (!filters) return undefined;

  const normalized: QueryFilters = {};

  if (filters.q) normalized.q = filters.q;
  if (filters.queue) normalized.queue = filters.queue;
  if (filters.state) normalized.state = filters.state;
  if (filters.from) normalized.from = filters.from;
  if (filters.to) normalized.to = filters.to;
  if (filters.sort) normalized.sort = filters.sort;
  if (filters.limit !== undefined) normalized.limit = filters.limit;
  if (filters.offset !== undefined) normalized.offset = filters.offset;

  const tags = Object.entries(filters.tags ?? {}).reduce<
    Record<string, string[]>
  >((acc, [field, values]) => {
    const cleaned = values.filter(Boolean);
    if (cleaned.length) acc[field] = cleaned;
    return acc;
  }, {});

  if (Object.keys(tags).length) normalized.tags = tags;

  return normalized;
}

export const queryKeys = {
  config: ["config"] as const,
  overview: ["overview"] as const,
  queues: ["queues"] as const,
  queue: (name: string) => ["queue", name] as const,
  jobs: (filters?: QueryFilters) =>
    ["jobs", normalizeJobsFilters(filters)] as const,
  futureJobs: (filters?: QueryFilters) =>
    ["future-jobs", normalizeJobsFilters(filters)] as const,
  jobSearch: (query: string) => ["job-search", query.trim()] as const,
  tagValues: (field: string, limit: number) =>
    ["tag-values", field, limit] as const,
  job: (id: string) => ["job", id] as const,
  schedules: ["schedules"] as const,
  deadLetter: ["dead-letter"] as const,
  warnings: ["warnings"] as const,
  metrics: ["metrics"] as const,
  activity: ["activity"] as const,
};

export const queryPrefixes = {
  jobs: ["jobs"] as const,
  job: ["job"] as const,
  queues: ["queues"] as const,
  queue: ["queue"] as const,
  overview: ["overview"] as const,
  deadLetter: ["dead-letter"] as const,
  metrics: ["metrics"] as const,
  activity: ["activity"] as const,
};

export const useConfig = () =>
  useQuery({
    queryKey: queryKeys.config,
    queryFn: api.config,
    staleTime: Infinity,
  });
export const useOverview = () =>
  useQuery({
    queryKey: queryKeys.overview,
    queryFn: api.overview,
    refetchInterval: 10_000,
  });
export const useQueues = () =>
  useQuery({
    queryKey: queryKeys.queues,
    queryFn: api.queues,
    refetchInterval: 10_000,
  });
export const useQueue = (name: string) =>
  useQuery({
    queryKey: queryKeys.queue(name),
    queryFn: () => api.queue(name),
    enabled: !!name,
    refetchInterval: 10_000,
  });
export const useJobs = (filters?: QueryFilters) =>
  useQuery({
    queryKey: queryKeys.jobs(filters),
    queryFn: () => {
      const query = normalizeJobsFilters(filters);
      return query?.queue ? api.queueJobs(query.queue, query) : api.jobs(query);
    },
    refetchInterval: 10_000,
  });
export const useFutureJobs = (filters?: QueryFilters) =>
  useQuery({
    queryKey: queryKeys.futureJobs(filters),
    queryFn: () => api.futureJobs(normalizeJobsFilters(filters)),
    refetchInterval: 10_000,
  });
export const useJobSearch = (query: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.jobSearch(query),
    queryFn: () => api.jobs({ q: query.trim(), limit: 5 }),
    enabled: enabled && !!query.trim(),
  });
export const useTagValues = (field: string, enabled = true, limit = 10) =>
  useQuery({
    queryKey: queryKeys.tagValues(field, limit),
    queryFn: () => api.tagValues(field, limit),
    enabled: enabled && !!field,
    staleTime: 5 * 60 * 1000,
  });
export const useJob = (id: string) =>
  useQuery({
    queryKey: queryKeys.job(id),
    queryFn: () => api.job(id),
    enabled: !!id,
    refetchInterval: 10_000,
  });
export const useSchedules = () =>
  useQuery({
    queryKey: queryKeys.schedules,
    queryFn: api.schedules,
    refetchInterval: 30_000,
  });
export const useDeadLetter = () =>
  useQuery({
    queryKey: queryKeys.deadLetter,
    queryFn: api.deadLetter,
    refetchInterval: 10_000,
  });
export const useWarnings = () =>
  useQuery({
    queryKey: queryKeys.warnings,
    queryFn: api.warnings,
    refetchInterval: 30_000,
  });
export const useMetrics = () =>
  useQuery({
    queryKey: queryKeys.metrics,
    queryFn: api.metrics,
    refetchInterval: 30_000,
  });
export const useActivity = () =>
  useQuery({
    queryKey: queryKeys.activity,
    queryFn: api.activity,
    refetchInterval: 30_000,
  });

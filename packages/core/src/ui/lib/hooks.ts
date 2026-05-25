import { useQuery } from "@tanstack/react-query";
import type { BossbenchJobState } from "../../core/types";
import { api } from "./api";

export const queryKeys = {
  config: ["config"] as const,
  overview: ["overview"] as const,
  queues: ["queues"] as const,
  queue: (name: string) => ["queue", name] as const,
  jobs: (q?: string, state?: string) => ["jobs", q, state] as const,
  job: (id: string) => ["job", id] as const,
  schedules: ["schedules"] as const,
  deadLetter: ["dead-letter"] as const,
  warnings: ["warnings"] as const,
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
export const useJobs = (filters?: {
  q?: string;
  state?: string;
  queue?: string;
  limit?: number;
}) =>
  useQuery({
    queryKey: queryKeys.jobs(filters?.q, filters?.state),
    queryFn: () => {
      const state =
        filters?.state && filters.state !== "all"
          ? (filters.state as BossbenchJobState)
          : undefined;
      const query = {
        ...(filters?.q ? { q: filters.q } : {}),
        ...(filters?.queue ? { queue: filters.queue } : {}),
        ...(filters?.limit ? { limit: filters.limit } : {}),
        ...(state ? { state } : {}),
      };
      return filters?.queue
        ? api.queueJobs(filters.queue, query)
        : api.jobs(query);
    },
    refetchInterval: 10_000,
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

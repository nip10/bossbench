import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(value: string | number | null | undefined) {
  if (value == null) return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  if (abs < 60_000)
    return `${Math.round(abs / 1000)}s${diff >= 0 ? " ago" : ""}`;
  if (abs < 3_600_000)
    return `${Math.round(abs / 60_000)}m${diff >= 0 ? " ago" : ""}`;
  if (abs < 86_400_000)
    return `${Math.round(abs / 3_600_000)}h${diff >= 0 ? " ago" : ""}`;
  return date.toLocaleString();
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export function truncate(value: string, length: number) {
  return value.length <= length ? value : `${value.slice(0, length)}…`;
}

import type React from "react";

export const NAV = [
  "overview",
  "jobs",
  "queues",
  "schedules",
  "dead-letter",
  "warnings",
  "metrics",
  "activity",
  "settings",
] as const;

export function UiShell({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

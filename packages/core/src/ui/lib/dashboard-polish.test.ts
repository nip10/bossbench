import { describe, expect, it, vi } from "vitest";
import {
  buildOverviewAttentionSignals,
  dashboardRefreshCue,
  dashboardShellHeightDeclaration,
  sidebarQueueListLimit,
} from "./dashboard-polish";

describe("dashboard polish helpers", () => {
  it("surfaces the highest-priority overview signals", () => {
    expect(
      buildOverviewAttentionSignals(
        {
          totals: {
            created: 8,
            retry: 1,
            active: 2,
            completed: 30,
            cancelled: 0,
            failed: 4,
          },
          queues: [],
          deadLetter: 2,
          warnings: 1,
        },
        {
          summary: {
            totalCreated: 40,
            totalCompleted: 30,
            totalFailed: 4,
            totalRetry: 1,
            throughputPerHour: 12.5,
            errorRate: 0.1,
            avgDurationMs: 10_000,
            avgWaitMs: 8_000,
          },
          buckets: [],
          queues: [
            {
              name: "alpha",
              created: 10,
              completed: 6,
              failed: 3,
              retry: 1,
              errorRate: 0.5,
              avgDurationMs: 12_000,
              avgWaitMs: 5_000,
              lastActivity: null,
            },
            {
              name: "beta",
              created: 4,
              completed: 4,
              failed: 0,
              retry: 0,
              errorRate: 0,
              avgDurationMs: 1_000,
              avgWaitMs: 250,
              lastActivity: null,
            },
          ],
        },
      ),
    ).toEqual([
      {
        tone: "critical",
        title: "Dead letter",
        value: "2",
        detail: "Jobs need inspection",
        href: "/dead-letter",
      },
      {
        tone: "warning",
        title: "Warnings",
        value: "1",
        detail: "Warnings need review",
        href: "/warnings",
      },
      {
        tone: "warning",
        title: "Failed jobs",
        value: "4",
        detail: "4 failed across the dashboard",
        href: "/metrics",
      },
      {
        tone: "critical",
        title: "Failing queue",
        value: "alpha",
        detail: "3 failed • 50% error rate",
        href: "/queues/alpha",
      },
    ]);
  });

  it("renders a live refresh cue from the latest update", () => {
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    try {
      expect(dashboardRefreshCue(now - 12_000)).toBe("Live • synced 12s ago");
      expect(dashboardRefreshCue(null)).toBe("Live");
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("uses container-safe shell height", () => {
    expect(dashboardShellHeightDeclaration()).toEqual({
      height: "100%",
      minHeight: "100vh",
    });
  });

  it("caps queue shortcuts before scrolling", () => {
    expect(sidebarQueueListLimit()).toBe(8);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  buildOverviewAttentionSignals,
  buildOverviewLiveStatus,
  buildOverviewQueueHealthCards,
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

  it("summarizes overview and metrics live status", () => {
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    try {
      expect(
        buildOverviewLiveStatus({
          overviewUpdatedAt: now - 12_000,
          metricsUpdatedAt: now - 8_000,
          metricsLoading: false,
          metricsError: null,
          hasMetrics: true,
        }),
      ).toEqual({
        tone: "success",
        title: "Live command center",
        detail: "Overview synced 12s ago. Health metrics synced 8s ago.",
        meta: "Metrics current",
      });

      expect(
        buildOverviewLiveStatus({
          overviewUpdatedAt: now - 30_000,
          metricsUpdatedAt: null,
          metricsLoading: true,
          metricsError: null,
          hasMetrics: false,
        }),
      ).toMatchObject({
        tone: "info",
        meta: "Loading health metrics",
        detail: "Overview synced 30s ago. Health metrics are loading.",
      });

      expect(
        buildOverviewLiveStatus({
          overviewUpdatedAt: now - 30_000,
          metricsUpdatedAt: now - 120_000,
          metricsLoading: false,
          metricsError: "database unavailable",
          hasMetrics: true,
        }),
      ).toMatchObject({
        tone: "warning",
        meta: "Showing cached health metrics",
      });

      expect(
        buildOverviewLiveStatus({
          overviewUpdatedAt: now - 10_000,
          metricsUpdatedAt: 0,
          metricsLoading: true,
          metricsError: null,
          hasMetrics: false,
        }),
      ).toMatchObject({
        tone: "info",
        meta: "Loading health metrics",
        detail: "Overview synced 10s ago. Health metrics are loading.",
      });

      expect(
        buildOverviewLiveStatus({
          overviewUpdatedAt: now - 45_000,
          metricsUpdatedAt: null,
          metricsLoading: false,
          metricsError: null,
          hasMetrics: false,
        }),
      ).toMatchObject({
        tone: "info",
        meta: "Queue counts only",
      });

      expect(
        buildOverviewLiveStatus({
          overviewUpdatedAt: now - 20_000,
          metricsUpdatedAt: 0,
          metricsLoading: false,
          metricsError: "database unavailable",
          hasMetrics: false,
        }),
      ).toMatchObject({
        tone: "warning",
        meta: "Health metrics unavailable",
        detail: "Overview synced 20s ago. Health metrics are unavailable.",
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("builds priority-ordered overview queue health cards", () => {
    const cards = buildOverviewQueueHealthCards(
      [
        {
          name: "quiet",
          total: 2,
          created: 0,
          retry: 0,
          active: 0,
          completed: 2,
          cancelled: 0,
          failed: 0,
        },
        {
          name: "created-only",
          total: 2,
          created: 2,
          retry: 0,
          active: 0,
          completed: 0,
          cancelled: 0,
          failed: 0,
        },
        {
          name: "retry-heavy",
          total: 7,
          created: 1,
          retry: 4,
          active: 0,
          completed: 2,
          cancelled: 0,
          failed: 0,
        },
        {
          name: "email",
          total: 10,
          created: 2,
          retry: 1,
          active: 1,
          completed: 3,
          cancelled: 0,
          failed: 3,
        },
      ],
      [
        {
          name: "email",
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
          name: "created-only",
          created: 1,
          completed: 0,
          failed: 0,
          retry: 0,
          errorRate: 0,
          avgDurationMs: 1_000,
          avgWaitMs: 1_000,
          lastActivity: null,
        },
        {
          name: "slow",
          created: 1,
          completed: 0,
          failed: 0,
          retry: 0,
          errorRate: 0,
          avgDurationMs: 35_000,
          avgWaitMs: 35_000,
          lastActivity: null,
        },
      ],
    );

    expect(cards.map((card: { name: string }) => card.name)).toEqual([
      "email",
      "retry-heavy",
      "created-only",
      "quiet",
    ]);
    expect(cards[0]).toMatchObject({
      tone: "critical",
      label: "Failing",
      href: "/queues/email",
      errorRate: "50%",
      avgWait: "5s",
      avgDuration: "12s",
    });
    expect(cards[1]).toMatchObject({
      tone: "warning",
      label: "Retry backlog",
      errorRate: "—",
    });
    expect(cards[2]).toMatchObject({
      label: "Busy",
      created: "2",
    });
  });

  it("formats large queue counts and slow thresholds", () => {
    const cards = buildOverviewQueueHealthCards(
      [
        {
          name: "big-created",
          total: 1200,
          created: 1200,
          retry: 0,
          active: 0,
          completed: 0,
          cancelled: 0,
          failed: 0,
        },
        {
          name: "slow-threshold",
          total: 1,
          created: 0,
          retry: 0,
          active: 0,
          completed: 1,
          cancelled: 0,
          failed: 0,
        },
      ],
      [
        {
          name: "big-created",
          created: 1200,
          completed: 0,
          failed: 0,
          retry: 0,
          errorRate: 0,
          avgDurationMs: 5_000,
          avgWaitMs: 5_000,
          lastActivity: null,
        },
        {
          name: "slow-threshold",
          created: 1,
          completed: 1,
          failed: 0,
          retry: 0,
          errorRate: 0,
          avgDurationMs: 35_000,
          avgWaitMs: 35_000,
          lastActivity: null,
        },
      ],
    );

    expect(cards.find((card) => card.name === "big-created")).toMatchObject({
      created: "1,200",
      label: "Busy",
    });
    expect(cards.find((card) => card.name === "slow-threshold")).toMatchObject({
      label: "Slow",
      tone: "info",
    });
  });

  it("returns no queue health cards when overview has no queues", () => {
    expect(buildOverviewQueueHealthCards([], [])).toEqual([]);
  });
});

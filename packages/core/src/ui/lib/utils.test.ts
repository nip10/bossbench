import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "./utils";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders future timestamps with in-prefix units", () => {
    expect(formatRelativeTime("2026-01-01T00:00:05.000Z")).toBe("in 5s");
    expect(formatRelativeTime("2026-01-01T00:02:00.000Z")).toBe("in 2m");
    expect(formatRelativeTime("2026-01-01T03:00:00.000Z")).toBe("in 3h");
  });

  it("renders past timestamps with ago suffix", () => {
    expect(formatRelativeTime("2025-12-31T23:59:55.000Z")).toBe("5s ago");
    expect(formatRelativeTime("2025-12-31T23:58:00.000Z")).toBe("2m ago");
    expect(formatRelativeTime("2025-12-31T21:00:00.000Z")).toBe("3h ago");
  });

  it("returns a placeholder for nullish values", () => {
    expect(formatRelativeTime(null)).toBe("—");
    expect(formatRelativeTime(undefined)).toBe("—");
  });

  it("returns invalid strings unchanged", () => {
    expect(formatRelativeTime("not-a-date")).toBe("not-a-date");
  });
});

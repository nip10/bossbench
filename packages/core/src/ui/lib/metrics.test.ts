import { describe, expect, it } from "vitest";
import { formatDurationMs, formatPercent, scaleValue } from "./metrics";

describe("metrics helpers", () => {
  it("formats durations", () => {
    expect(formatDurationMs(null)).toBe("—");
    expect(formatDurationMs(250)).toBe("250ms");
    expect(formatDurationMs(1500)).toBe("1.5s");
    expect(formatDurationMs(120000)).toBe("2m");
  });

  it("formats percentages", () => {
    expect(formatPercent(0.1234)).toBe("12.3%");
  });

  it("scales values safely", () => {
    expect(scaleValue(5, 10)).toBe(50);
    expect(scaleValue(5, 0)).toBe(0);
    expect(scaleValue(200, 100)).toBe(100);
  });
});

# Future Timestamp Copy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render future relative timestamps as `in Xs/Xm/Xh` while preserving existing Bossbench fallbacks and past-time behavior.

**Architecture:** This is a focused utility change in the core dashboard UI package. `RelativeTime` already delegates to `formatRelativeTime`, so fixing the shared formatter updates all existing timestamp surfaces without touching pages/components.

**Tech Stack:** TypeScript, React UI utilities, Vitest, Bun/Turbo monorepo.

---

### Task 1: Add formatter regression tests

**Files:**
- Create: `packages/core/src/ui/lib/utils.test.ts`
- Modify: none

**Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "./utils";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("labels future timestamps with an in prefix", () => {
    expect(formatRelativeTime("2026-05-26T12:00:05.000Z")).toBe("in 5s");
    expect(formatRelativeTime("2026-05-26T12:02:00.000Z")).toBe("in 2m");
    expect(formatRelativeTime("2026-05-26T15:00:00.000Z")).toBe("in 3h");
  });

  it("keeps past timestamp copy unchanged", () => {
    expect(formatRelativeTime("2026-05-26T11:59:55.000Z")).toBe("5s ago");
    expect(formatRelativeTime("2026-05-26T11:58:00.000Z")).toBe("2m ago");
    expect(formatRelativeTime("2026-05-26T09:00:00.000Z")).toBe("3h ago");
  });

  it("keeps safe fallbacks for nullish and invalid inputs", () => {
    expect(formatRelativeTime(null)).toBe("—");
    expect(formatRelativeTime(undefined)).toBe("—");
    expect(formatRelativeTime("not-a-date")).toBe("not-a-date");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter=@bossbench/core test -- src/ui/lib/utils.test.ts`

Expected: FAIL because future timestamps currently return `5s`, `2m`, and `3h` without the `in ` prefix.

### Task 2: Implement future copy

**Files:**
- Modify: `packages/core/src/ui/lib/utils.ts:8-21`
- Test: `packages/core/src/ui/lib/utils.test.ts`

**Step 1: Write minimal implementation**

Update `formatRelativeTime` so sub-day future values return `in ${amount}${unit}` and sub-day past values still return `${amount}${unit} ago`.

**Step 2: Run focused test**

Run: `bun run --filter=@bossbench/core test -- src/ui/lib/utils.test.ts`

Expected: PASS.

**Step 3: Run package tests**

Run: `bun run --filter=@bossbench/core test`

Expected: PASS.

### Task 3: Final verification

**Files:**
- Verify: `packages/core/src/ui/lib/utils.ts`
- Verify: `packages/core/src/ui/lib/utils.test.ts`

**Step 1: Run formatting/lint relevant to touched files if available**

Run: `bun run lint`

Expected: PASS or report any unrelated baseline failures separately.

**Step 2: Inspect git diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intended files changed.

**Step 3: Do not commit unless explicitly requested**

This session should leave changes staged/unstaged for review unless the user explicitly asks for a commit.

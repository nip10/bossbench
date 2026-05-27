import { describe, expect, it } from "vitest";
import {
  dashboardShellHeightDeclaration,
  sidebarQueueListLimit,
} from "./dashboard-polish";

describe("dashboard polish helpers", () => {
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

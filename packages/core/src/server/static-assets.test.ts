import { describe, expect, it } from "vitest";
import { renderIndexHtml } from "./static-assets";

describe("renderIndexHtml", () => {
  it("fallback html includes the app icon", () => {
    const html = renderIndexHtml("/jobs/", "Bossbench");

    expect(html.body).toContain('rel="icon"');
    expect(html.body).toContain('href="/jobs/app-icon.svg"');
  });
});

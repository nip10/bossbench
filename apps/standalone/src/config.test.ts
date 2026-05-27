import { describe, expect, it } from "vitest";
import {
  readStandaloneConfig,
  shouldRedirectRoot,
  shouldStartBoss,
} from "./config";

describe("readStandaloneConfig", () => {
  it("defaults to read-only without explicit writable auth", () => {
    const config = readStandaloneConfig({ DATABASE_URL: "postgres://x" });
    expect(config.basePath).toBe("/");
    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(3000);
    expect(config.readonly).toBe(true);
    expect(config.auth).toBeUndefined();
  });

  it("enables writable mode only with auth and writable flag", () => {
    const config = readStandaloneConfig({
      DATABASE_URL: "postgres://x",
      BOSSBENCH_USER: "admin",
      BOSSBENCH_PASS: "secret",
      WRITABLE: "true",
      BASE_PATH: "/jobs",
      HOST: "127.0.0.1",
      PORT: "4000",
    });
    expect(config.readonly).toBe(false);
    expect(config.basePath).toBe("/jobs/");
    expect(config.auth).toEqual({ username: "admin", password: "secret" });
  });

  it("starts pg-boss only for explicitly writable deployments", () => {
    expect(
      shouldStartBoss(readStandaloneConfig({ DATABASE_URL: "postgres://x" })),
    ).toBe(false);
    expect(
      shouldStartBoss(
        readStandaloneConfig({
          DATABASE_URL: "postgres://x",
          BOSSBENCH_USER: "admin",
          BOSSBENCH_PASS: "secret",
          WRITABLE: "true",
        }),
      ),
    ).toBe(true);
  });

  it("redirects root only when the dashboard is mounted below root", () => {
    expect(
      shouldRedirectRoot(
        readStandaloneConfig({ DATABASE_URL: "postgres://x" }),
      ),
    ).toBe(false);
    expect(
      shouldRedirectRoot(
        readStandaloneConfig({
          DATABASE_URL: "postgres://x",
          BASE_PATH: "/jobs",
        }),
      ),
    ).toBe(true);
  });
});

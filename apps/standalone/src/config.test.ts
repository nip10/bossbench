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

  it("parses a single DATABASE_URL as one unnamed database", () => {
    const config = readStandaloneConfig({ DATABASE_URL: "postgres://x" });
    expect(config.databases).toEqual([
      {
        id: "1",
        name: "Database 1",
        databaseUrl: "postgres://x",
        schema: "pgboss",
      },
    ]);
  });

  it("parses multiple pipe-separated, optionally named databases", () => {
    const config = readStandaloneConfig({
      DATABASE_URL: "prod::postgres://prod-host/db|postgres://staging-host/db",
      PGBOSS_SCHEMA: "pgboss_prod|pgboss_staging",
    });
    expect(config.databases).toEqual([
      {
        id: "1",
        name: "prod",
        databaseUrl: "postgres://prod-host/db",
        schema: "pgboss_prod",
      },
      {
        id: "2",
        name: "Database 2",
        databaseUrl: "postgres://staging-host/db",
        schema: "pgboss_staging",
      },
    ]);
  });

  it("applies a single PGBOSS_SCHEMA to every configured database", () => {
    const config = readStandaloneConfig({
      DATABASE_URL: "a::postgres://a-host/db|b::postgres://b-host/db",
      PGBOSS_SCHEMA: "shared_schema",
    });
    expect(config.databases.map((db) => db.schema)).toEqual([
      "shared_schema",
      "shared_schema",
    ]);
  });

  it("throws when a DATABASE_URL entry is missing its connection string", () => {
    expect(() => readStandaloneConfig({ DATABASE_URL: "prod::" })).toThrow(
      /entry 1 is missing a connection string/,
    );
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

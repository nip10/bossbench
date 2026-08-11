export type StandaloneDatabaseConfig = {
  id: string;
  name: string;
  databaseUrl: string;
  schema: string;
};

export type StandaloneConfig = {
  databases: StandaloneDatabaseConfig[];
  basePath: string;
  host: string;
  port: number;
  title: string;
  readonly: boolean;
  auth?: { username: string; password: string };
};

export function readStandaloneConfig(
  env: Record<string, string | undefined>,
): StandaloneConfig {
  const databases = parseDatabases(env);
  const basePath = normalizeBasePath(env.BASE_PATH ?? env.BOSSBENCH_BASE_PATH);
  const host = env.HOST?.trim() || "0.0.0.0";
  const port = toPort(env.PORT, 3000);
  const title = env.TITLE?.trim() || "Bossbench";
  const auth = readAuth(env);
  const writable = isTruthy(env.WRITABLE ?? env.BOSSBENCH_WRITABLE);
  const readonly = !auth || !writable;

  return {
    databases,
    basePath,
    host,
    port,
    title,
    readonly,
    ...(auth ? { auth } : {}),
  };
}

/**
 * DATABASE_URL accepts multiple `|`-separated connections for multi-database
 * mode, each optionally named via a `name::connectionString` prefix (`::` is
 * used instead of `=` since libpq keyword/value connection strings already
 * contain `=`). PGBOSS_SCHEMA mirrors the same `|`-separated shape, aligned
 * by position; a single value applies to every database.
 */
function parseDatabases(
  env: Record<string, string | undefined>,
): StandaloneDatabaseConfig[] {
  const raw = required(env.DATABASE_URL, "DATABASE_URL is required");
  const entries = raw
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!entries.length) throw new Error("DATABASE_URL is required");

  const schemaEnv = env.PGBOSS_SCHEMA?.trim() || env.SCHEMA?.trim() || "";
  const schemas = schemaEnv
    .split("|")
    .map((schema) => schema.trim())
    .filter(Boolean);

  return entries.map((entry, index) => {
    const separatorIndex = entry.indexOf("::");
    const name =
      separatorIndex >= 0
        ? entry.slice(0, separatorIndex).trim()
        : `Database ${index + 1}`;
    const databaseUrl =
      separatorIndex >= 0 ? entry.slice(separatorIndex + 2).trim() : entry;
    if (!databaseUrl)
      throw new Error(
        `DATABASE_URL entry ${index + 1} is missing a connection string`,
      );
    const schema = schemas[index] ?? schemas[0] ?? "pgboss";
    return { id: String(index + 1), name, databaseUrl, schema };
  });
}

export function shouldStartBoss(config: StandaloneConfig) {
  return !config.readonly;
}

export function shouldRedirectRoot(config: StandaloneConfig) {
  return config.basePath !== "/";
}

function readAuth(env: Record<string, string | undefined>) {
  const username =
    env.BOSSBENCH_USER?.trim() || env.BASIC_AUTH_USERNAME?.trim();
  const password = env.BOSSBENCH_PASS ?? env.BASIC_AUTH_PASSWORD ?? "";
  if (!username || !password) return undefined;
  return { username, password };
}

function normalizeBasePath(value: string | undefined) {
  const trimmed = value?.trim() || "/";
  if (!trimmed.startsWith("/")) return `/${trimmed}`;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function toPort(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function isTruthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value ?? "").toLowerCase());
}

function required(value: string | undefined, message: string) {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

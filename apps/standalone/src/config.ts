export type StandaloneConfig = {
  databaseUrl: string;
  schema: string;
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
  const databaseUrl = required(env.DATABASE_URL, "DATABASE_URL is required");
  const schema = env.PGBOSS_SCHEMA?.trim() || env.SCHEMA?.trim() || "pgboss";
  const basePath = normalizeBasePath(env.BASE_PATH ?? env.BOSSBENCH_BASE_PATH);
  const host = env.HOST?.trim() || "0.0.0.0";
  const port = toPort(env.PORT, 3000);
  const title = env.TITLE?.trim() || "Bossbench";
  const auth = readAuth(env);
  const writable = isTruthy(env.WRITABLE ?? env.BOSSBENCH_WRITABLE);
  const readonly = !auth || !writable;

  return {
    databaseUrl,
    schema,
    basePath,
    host,
    port,
    title,
    readonly,
    ...(auth ? { auth } : {}),
  };
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

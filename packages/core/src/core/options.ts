import { assertSafeIdentifier } from "./identifiers";
import type { BossbenchOptions, NormalizedBossbenchOptions } from "./types";
export function normalizeOptions(
  options: BossbenchOptions,
): NormalizedBossbenchOptions {
  if (!options.db && !options.boss)
    throw new Error("Bossbench requires a db connection or a pg-boss instance");
  const auth = normalizeAuth(options.auth);
  if (!auth && !options.allowUnauthenticated)
    throw new Error(
      "Bossbench requires non-empty auth or allowUnauthenticated: true",
    );
  const schema = assertSafeIdentifier(options.schema ?? "pgboss");
  const { auth: _auth, ...rest } = options;
  return {
    ...rest,
    ...(auth ? { auth } : {}),
    schema,
    title: options.title ?? "Bossbench",
    readonly: options.readonly ?? !auth,
    tags: options.tags ?? [],
    basePath: options.basePath ?? "/",
  };
}

function normalizeAuth(auth: BossbenchOptions["auth"]) {
  if (!auth?.username || !auth.password) return undefined;
  return auth;
}

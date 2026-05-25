const CLIENT_ROUTE_PATTERNS = [
  /\/queues\/[^/]+\/jobs\/[^/]+\/?$/,
  /\/queues\/[^/]+\/?$/,
  /\/dead-letter\/?$/,
  /\/schedules\/?$/,
  /\/warnings\/?$/,
  /\/metrics\/?$/,
  /\/activity\/?$/,
  /\/settings\/?$/,
  /\/jobs\/[^/]+\/?$/,
  /\/queues\/?$/,
  /\/jobs\/?$/,
] as const;

export function computeBasePath(pathname: string) {
  let base = pathname || "/";

  for (const pattern of CLIENT_ROUTE_PATTERNS) {
    const next = base.replace(pattern, "");
    if (next !== base) {
      base = next;
      break;
    }
  }

  return withTrailingSlash(base || "/");
}

export function resolveBasePath(
  override: string | undefined,
  pathname: string,
) {
  if (override && override !== "/") return withTrailingSlash(override);
  return computeBasePath(pathname);
}

function withTrailingSlash(path: string) {
  return path.endsWith("/") ? path : `${path}/`;
}

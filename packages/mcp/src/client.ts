export class BossbenchApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BossbenchApiError";
  }
}

export type BossbenchClientOptions = {
  url: string;
  username?: string;
  password?: string;
  token?: string;
  fetch?: typeof fetch;
};

export function normalizeDashboardUrl(url: string) {
  const normalized = url.replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

export class BossbenchClient {
  private readonly apiUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: BossbenchClientOptions) {
    this.apiUrl = normalizeDashboardUrl(options.url);
    this.fetchImpl = options.fetch ?? fetch;
  }

  async get(path: string, query?: Record<string, unknown>) {
    const url = new URL(
      `${this.apiUrl}${path.startsWith("/") ? path : `/${path}`}`,
    );
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
    const response = await this.fetchImpl(url.toString(), {
      headers: this.headers(),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = extractErrorMessage(payload) ?? `HTTP ${response.status}`;
      throw new BossbenchApiError(message, response.status);
    }
    return payload;
  }

  private headers() {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.options.token) {
      headers.Authorization = `Bearer ${this.options.token}`;
      return headers;
    }
    if (this.options.username && this.options.password) {
      headers.Authorization = `Basic ${btoa(`${this.options.username}:${this.options.password}`)}`;
    }
    return headers;
  }
}

function extractErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("error" in payload))
    return undefined;
  const error = (payload as { error?: { message?: unknown; detail?: unknown } })
    .error;
  const message = error?.message ?? error?.detail;
  return typeof message === "string" ? message : undefined;
}

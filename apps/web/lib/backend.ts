/**
 * Centralized FastAPI backend caller for Next.js routes.
 *
 * Features:
 * - Single source of truth for backend base URL (no hard-coding in routes)
 * - Configurable per-request timeout (default 10s, override with BACKEND_TIMEOUT_MS)
 * - Normalizes all fetch errors into a typed BackendError
 * - Automatically logs failures with the endpoint path for easy debugging
 */

const BACKEND_BASE =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

const DEFAULT_TIMEOUT_MS = parseInt(process.env.BACKEND_TIMEOUT_MS ?? "10000", 10);
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? "";

export class BackendError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly path: string,
  ) {
    super(message);
    this.name = "BackendError";
  }

  /** True if the backend returned a 4xx status (client error). */
  get isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  /** True if backend is unreachable or returned 5xx. */
  get isServerError() {
    return this.status === 0 || this.status >= 500;
  }
}

type CallOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

/**
 * Call a FastAPI backend endpoint and return the parsed JSON response.
 *
 * @param path  Path relative to /api/v1 — e.g. "scans/guest"
 * @param opts  Optional: method, body, timeout, extra headers
 * @throws BackendError on HTTP errors or fetch failures
 */
export async function callBackend<T = unknown>(path: string, opts: CallOptions = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = opts;
  const url = `${BACKEND_BASE}/api/v1/${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };
  if (INTERNAL_API_SECRET) {
    requestHeaders["X-ScanVul-Internal-Secret"] = INTERNAL_API_SECRET;
  }

  const init: RequestInit = {
    method,
    headers: requestHeaders,
    signal: controller.signal,
  };

  if (body !== undefined && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.error(`[backend] ${method} ${path} — ${isTimeout ? "timeout" : "network error"}:`, err);
    throw new BackendError(
      0,
      isTimeout
        ? `Backend request timed out after ${timeoutMs}ms`
        : "Backend unreachable — ensure the Python API is running",
      path,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      detail = errBody?.detail ?? errBody?.error ?? detail;
    } catch {
      // ignore parse error, use status text
      detail = response.statusText || detail;
    }
    console.error(`[backend] ${method} ${path} — ${response.status}: ${detail}`);
    throw new BackendError(response.status, detail, path);
  }

  const data = await response.json() as T;
  return data;
}

/**
 * Convenience: POST to a backend path and return parsed JSON.
 */
export async function postBackend<T = unknown>(path: string, body: unknown, opts: Omit<CallOptions, "method" | "body"> = {}): Promise<T> {
  return callBackend<T>(path, { ...opts, method: "POST", body });
}

/**
 * Convenience: GET from a backend path and return parsed JSON.
 */
export async function getBackend<T = unknown>(path: string, opts: Omit<CallOptions, "method" | "body"> = {}): Promise<T> {
  return callBackend<T>(path, { ...opts, method: "GET" });
}

// AI : shared fetch helpers for client components and run-engine.

export const JSON_HEADERS = { "Content-Type": "application/json" } as const;
export const FETCH_CREDENTIALS = "same-origin" as const;
export const FETCH_NO_STORE = { cache: "no-store" as const };

export type ApiErrorBody = {
  error?: string;
  detail?: string;
  code?: string;
  resource?: string;
  tier?: string;
  retryAfterSec?: number;
};

export async function readApiErrorBody(res: Response): Promise<ApiErrorBody | null> {
  const raw = await res.text();
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as ApiErrorBody;
  } catch {
    return { error: raw.slice(0, 240) };
  }
}

export function formatApiError(context: string, res: Response, body: ApiErrorBody | null): string {
  const parts = [body?.error, body?.detail].filter(Boolean);
  const suffix = parts.length > 0 ? `: ${parts.join(" — ")}` : "";
  const code = body?.code ? ` [${body.code}]` : "";
  const retryHdr = res.headers.get("Retry-After");
  const retry =
    body?.retryAfterSec != null
      ? ` retryAfter=${body.retryAfterSec}s`
      : retryHdr
        ? ` retryAfter=${retryHdr}s`
        : "";
  const resource = body?.resource ? ` resource=${body.resource}` : "";
  const tier = body?.tier ? ` tier=${body.tier}` : "";
  return `${context} (HTTP ${res.status})${code}${suffix}${resource}${tier}${retry}`;
}

// AI : Chrome's "Failed to load resource" truncates paths (e.g. keys) and hides bodies — always print ours.
export function logApiFailure(
  url: string,
  res: Response,
  body: ApiErrorBody | null,
  method = "GET",
): void {
  const verb = method.toUpperCase();
  console.error(`[api] ${formatApiError(`${verb} ${url}`, res, body)}`, {
    method: verb,
    url,
    status: res.status,
    statusText: res.statusText || undefined,
    code: body?.code,
    error: body?.error,
    detail: body?.detail,
    resource: body?.resource,
    tier: body?.tier,
    retryAfterSec: body?.retryAfterSec ?? (res.headers.get("Retry-After") || undefined),
  });
}

export async function parseFetchJson<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await readApiErrorBody(res);
    logApiFailure(context, res, body);
    throw new Error(formatApiError(context, res, body));
  }
  const raw = await res.text();
  if (!raw.trim()) throw new Error(`${context}: empty response (HTTP ${res.status})`);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${context}: invalid JSON response (HTTP ${res.status})`);
  }
}

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const res = await fetch(url, { credentials: FETCH_CREDENTIALS, ...init });
  if (!res.ok) {
    const body = await readApiErrorBody(res);
    logApiFailure(url, res, body, method);
    throw new Error(formatApiError(`${method} ${url}`, res, body));
  }
  return res.json() as Promise<T>;
}

export async function apiText(url: string, init?: RequestInit): Promise<string> {
  const method = (init?.method ?? "GET").toUpperCase();
  const res = await fetch(url, { credentials: FETCH_CREDENTIALS, ...init });
  if (!res.ok) {
    const body = await readApiErrorBody(res);
    logApiFailure(url, res, body, method);
    throw new Error(formatApiError(`${method} ${url}`, res, body));
  }
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const data = (await res.json()) as { text?: string };
    if (typeof data.text === "string") return data.text;
  }
  return res.text();
}

// AI : PUT with soft failure — store surfaces saveError instead of throwing.
export async function apiPut(
  url: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: JSON_HEADERS,
      body,
      credentials: FETCH_CREDENTIALS,
    });
    if (!res.ok) {
      const parsed = await readApiErrorBody(res);
      logApiFailure(url, res, parsed, "PUT");
      return {
        ok: false,
        error: formatApiError(`PUT ${url}`, res, parsed),
        status: res.status,
      };
    }
    return { ok: true };
  } catch (err) {
    console.error(`[api] PUT ${url} network failure`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}

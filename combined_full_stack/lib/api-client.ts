// AI : shared fetch helpers for client components and run-engine.

export const JSON_HEADERS = { "Content-Type": "application/json" } as const;
export const FETCH_CREDENTIALS = "same-origin" as const;
export const FETCH_NO_STORE = { cache: "no-store" as const };

export type ApiErrorBody = { error?: string; detail?: string; code?: string };

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
  return `${context} (HTTP ${res.status})${code}${suffix}`;
}

export async function parseFetchJson<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await readApiErrorBody(res);
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
  const res = await fetch(url, { credentials: FETCH_CREDENTIALS, ...init });
  if (!res.ok) {
    const body = await readApiErrorBody(res);
    throw new Error(formatApiError(url, res, body));
  }
  return res.json() as Promise<T>;
}

export async function apiText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, { credentials: FETCH_CREDENTIALS, ...init });
  if (!res.ok) {
    const body = await readApiErrorBody(res);
    throw new Error(formatApiError(url, res, body));
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
      return { ok: false, error: parsed?.error ?? `save failed (${res.status})`, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}

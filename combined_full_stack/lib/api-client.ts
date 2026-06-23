// AI : shared fetch helpers for client components and run-engine.

export type ApiErrorBody = { error?: string; detail?: string; code?: string };

export async function readApiErrorBody(res: Response): Promise<ApiErrorBody | null> {
  try {
    return (await res.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

export function formatApiError(context: string, res: Response, body: ApiErrorBody | null): string {
  const parts = [body?.error, body?.detail].filter(Boolean);
  const suffix = parts.length > 0 ? `: ${parts.join(" — ")}` : "";
  const code = body?.code ? ` [${body.code}]` : "";
  return `${context} (HTTP ${res.status})${code}${suffix}`;
}

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  if (!res.ok) {
    const body = await readApiErrorBody(res);
    throw new Error(formatApiError(url, res, body));
  }
  return res.json() as Promise<T>;
}

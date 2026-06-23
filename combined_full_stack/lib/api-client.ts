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

export async function apiText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "same-origin",
    });
    if (!res.ok) {
      const parsed = await readApiErrorBody(res);
      return { ok: false, error: parsed?.error ?? `save failed (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}

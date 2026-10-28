// AI : normalize + match website origins for Embed frame-ancestors / parentOrigin checks.

export type embed_origin_string = string;

const ORIGIN_RE = /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i;

export function normalizeEmbedOrigin(raw: string): embed_origin_string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    const origin = `${url.protocol}//${url.host}`;
    if (!ORIGIN_RE.test(origin)) return null;
    return origin;
  } catch {
    return null;
  }
}

export function normalizeEmbedOrigins(raw: string[]): embed_origin_string[] {
  const out: embed_origin_string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const origin = normalizeEmbedOrigin(item);
    if (!origin || seen.has(origin.toLowerCase())) continue;
    seen.add(origin.toLowerCase());
    out.push(origin);
  }
  return out;
}

export function originMatchesAllowlist(
  origin: string | null | undefined,
  allowlist: readonly string[],
): boolean {
  if (!origin || allowlist.length === 0) return false;
  const normalized = normalizeEmbedOrigin(origin);
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  return allowlist.some((allowed) => allowed.toLowerCase() === lower);
}

export function frameAncestorsCsp(allowlist: readonly string[]): string {
  const parts = ["'self'", ...allowlist];
  return `frame-ancestors ${parts.join(" ")}`;
}

export function isEmbedLinkId(id: string): boolean {
  return /^emb_/i.test(id);
}

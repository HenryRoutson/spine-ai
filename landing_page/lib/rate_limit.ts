// AI : in-memory IP rate limit for landing page proxy — per-instance on Vercel, still blocks casual abuse.

type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

const WINDOW_MS = 600_000;
const MAX = 12;
const buckets = new Map<string, number[]>();

export function checkLandingProxyRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const prev = buckets.get(ip) ?? [];
  const kept = prev.filter((t) => t > cutoff);
  if (kept.length >= MAX) {
    const retryAfterSec = Math.max(1, Math.ceil((kept[0]! + WINDOW_MS - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  kept.push(now);
  buckets.set(ip, kept);
  return { ok: true };
}

export function clientIpFromRequest(headers: Headers): string {
  if (process.env.VERCEL) {
    const vercelIp = headers.get("x-vercel-forwarded-for")?.trim();
    if (vercelIp) return vercelIp;
  }
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() ?? "127.0.0.1";
}

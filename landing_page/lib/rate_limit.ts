// AI : in-memory IP rate limit for landing page proxy — per-instance on Vercel, still blocks casual abuse.
// AI : limits mirror combined_full_stack RATE_LIMITS.landing_demo_* tiers.

import { clientIpFromHeaders } from "@shared/rate-limit/client-ip";

type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };
type rate_limit_bucket = "build" | "replay";

const LIMITS: Record<rate_limit_bucket, { windowMs: number; max: number }> = {
  build: { windowMs: 600_000, max: 12 },
  // AI : rrweb flushes every ~8s — allow a bursty minute without blocking the demo.
  replay: { windowMs: 60_000, max: 40 },
};

const buckets = new Map<string, number[]>();

function checkBucket(ip: string, bucket: rate_limit_bucket): RateLimitResult {
  const { windowMs, max } = LIMITS[bucket];
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const cutoff = now - windowMs;
  const prev = buckets.get(key) ?? [];
  const kept = prev.filter((t) => t > cutoff);
  if (kept.length >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((kept[0]! + windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  kept.push(now);
  buckets.set(key, kept);
  return { ok: true };
}

export function checkLandingProxyRateLimit(ip: string): RateLimitResult {
  return checkBucket(ip, "build");
}

export function checkLandingReplayProxyRateLimit(ip: string): RateLimitResult {
  return checkBucket(ip, "replay");
}

export function clientIpFromRequest(headers: Headers): string {
  return clientIpFromHeaders(headers, "127.0.0.1");
}

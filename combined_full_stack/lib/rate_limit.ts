// AI : edge + server rate limiting — Upstash (default) or in-memory when RATE_LIMIT_BACKEND=memory.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  type RateLimitBackend,
  type RateLimitKey,
  type RateLimitTier,
  RATE_LIMITS,
  resolveRateLimitBackend,
  upstashConfigured,
} from "./rate_limit_config";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; misconfigured?: boolean };

type MemoryBucket = number[];

const memoryBuckets = new Map<string, MemoryBucket>();
let warnedMissingUpstash = false;
const upstashLimiters = new Map<RateLimitTier, Ratelimit>();

function warnMissingUpstash(): void {
  if (warnedMissingUpstash) return;
  warnedMissingUpstash = true;
  const msg =
    "[rate-limit] RATE_LIMIT_BACKEND=upstash but UPSTASH_REDIS_REST_URL/TOKEN missing — falling back to in-memory (per-instance only)";
  if (process.env.VERCEL) console.error(msg);
  else console.warn(msg);
}

type EffectiveBackend = RateLimitBackend | "blocked";

function effectiveBackend(): EffectiveBackend {
  if (resolveRateLimitBackend() === "memory") return "memory";
  if (!upstashConfigured()) {
    warnMissingUpstash();
    // AI : Vercel serverless — in-memory limits are per-instance and trivially bypassed.
    if (process.env.VERCEL) return "blocked";
    return "memory";
  }
  return "upstash";
}

function memoryCheck(key: string, tier: RateLimitTier): RateLimitResult {
  const { windowMs, max } = RATE_LIMITS[tier];
  const now = Date.now();
  const cutoff = now - windowMs;
  const prev = memoryBuckets.get(key) ?? [];
  const kept = prev.filter((t) => t > cutoff);
  if (kept.length >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((kept[0]! + windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  kept.push(now);
  memoryBuckets.set(key, kept);
  return { ok: true };
}

function upstashLimiter(tier: RateLimitTier): Ratelimit {
  const cached = upstashLimiters.get(tier);
  if (cached) return cached;
  const { windowMs, max } = RATE_LIMITS[tier];
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(max, `${Math.max(1, Math.round(windowMs / 1000))} s`),
    prefix: `rl:${tier}`,
    analytics: false,
  });
  upstashLimiters.set(tier, limiter);
  return limiter;
}

async function upstashCheck(key: string, tier: RateLimitTier): Promise<RateLimitResult> {
  const { success, reset } = await upstashLimiter(tier).limit(key);
  if (success) return { ok: true };
  const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return { ok: false, retryAfterSec };
}

export async function checkRateLimit(key: RateLimitKey, tier: RateLimitTier): Promise<RateLimitResult> {
  const backend = effectiveBackend();
  if (backend === "blocked") return { ok: false, retryAfterSec: 60, misconfigured: true };
  if (backend === "memory") return memoryCheck(key, tier);
  return upstashCheck(key, tier);
}

export function clientIpFromHeaders(headers: Headers): string {
  // AI : Vercel sets this — do not trust client-supplied X-Forwarded-For on production.
  if (process.env.VERCEL) {
    const vercelIp = headers.get("x-vercel-forwarded-for")?.trim();
    if (vercelIp) return vercelIp;
  }
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

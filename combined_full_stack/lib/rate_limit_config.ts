// AI : shared rate-limit tiers — safe for edge (proxy) and server route handlers.

export type RateLimitBackend = "upstash" | "memory";
export type RateLimitTier = "default" | "llm" | "public" | "feedback";
export type RateLimitKey = string & { __brand: "RateLimitKey" };

export const RATE_LIMITS: Record<RateLimitTier, { windowMs: number; max: number }> = {
  default: { windowMs: 60_000, max: 60 },
  llm: { windowMs: 60_000, max: 10 },
  public: { windowMs: 60_000, max: 20 },
  feedback: { windowMs: 60_000, max: 5 },
};

// AI : default production (Upstash); set RATE_LIMIT_BACKEND=memory for local dev without Redis.
export function resolveRateLimitBackend(): RateLimitBackend {
  const raw = process.env.RATE_LIMIT_BACKEND?.trim().toLowerCase();
  if (raw === "memory" || raw === "local") return "memory";
  return "upstash";
}

export function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

export function publicApiTier(pathname: string): RateLimitTier | null {
  if (pathname === "/api/billing/webhook" || pathname === "/api/supabase-env") return null;
  if (!pathname.startsWith("/api/shared-links/")) return null;
  if (/\/run$/.test(pathname)) return "llm";
  return "public";
}

// AI : shared rate-limit tiers — safe for edge (proxy) and server route handlers.

export type RateLimitBackend = "upstash" | "memory";
export type RateLimitTier =
  | "default"
  | "llm"
  | "public"
  | "feedback"
  | "poll"
  | "read"
  | "webhook"
  | "billing"
  | "shared_run";
export type RateLimitKey = string & { __brand: "RateLimitKey" };

export const RATE_LIMITS: Record<RateLimitTier, { windowMs: number; max: number }> = {
  default: { windowMs: 60_000, max: 60 },
  llm: { windowMs: 60_000, max: 10 },
  public: { windowMs: 60_000, max: 20 },
  feedback: { windowMs: 60_000, max: 5 },
  poll: { windowMs: 60_000, max: 120 },
  // AI : GET /api/docs/:id/text — many docs load on project open; keep off the default bucket.
  read: { windowMs: 60_000, max: 240 },
  webhook: { windowMs: 60_000, max: 120 },
  billing: { windowMs: 60_000, max: 20 },
  // AI : per-link + IP — limits anonymous credit drain on sharer_pays links.
  shared_run: { windowMs: 600_000, max: 5 },
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
  if (pathname === "/api/billing/webhook") return "webhook";
  if (pathname === "/api/supabase-env") return "public";
  if (!pathname.startsWith("/api/shared-links/")) return null;
  if (/\/run$/.test(pathname)) return "llm";
  if (/\/progress$/.test(pathname)) return "poll";
  if (/\/client-step$/.test(pathname)) return "default";
  return "public";
}

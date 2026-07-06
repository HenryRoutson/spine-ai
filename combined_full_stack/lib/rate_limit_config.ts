// AI : shared rate-limit tiers — safe for edge (proxy) and server route handlers.

export type RateLimitBackend = "upstash" | "memory";
export type RateLimitTier =
  | "default"
  | "llm"
  | "public"
  | "feedback"
  | "poll"
  | "read"
  | "write"
  | "webhook"
  | "billing"
  | "shared_run"
  | "hosted_api"
  | "landing_demo_build";
export type RateLimitKey = string & { __brand: "RateLimitKey" };

export const RATE_LIMITS: Record<RateLimitTier, { windowMs: number; max: number }> = {
  default: { windowMs: 60_000, max: 90 },
  llm: { windowMs: 60_000, max: 10 },
  public: { windowMs: 60_000, max: 20 },
  feedback: { windowMs: 60_000, max: 5 },
  poll: { windowMs: 60_000, max: 120 },
  // AI : GET /api/state, /api/docs/:id/text, templates — must not share the write/autosave bucket.
  read: { windowMs: 60_000, max: 240 },
  // AI : debounced PUT /api/projects/[id] can fire ~120/min while editing — keep off default/read.
  write: { windowMs: 60_000, max: 180 },
  webhook: { windowMs: 60_000, max: 120 },
  billing: { windowMs: 60_000, max: 20 },
  // AI : per-link + IP — limits anonymous credit drain on sharer_pays links.
  shared_run: { windowMs: 600_000, max: 5 },
  // AI : bearer-key pipeline invoke — per-api + IP cap.
  hosted_api: { windowMs: 600_000, max: 30 },
  // AI : landing pipeline builds — budget-gated; IP capped alongside budget.
  landing_demo_build: { windowMs: 600_000, max: 12 },
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
  if (pathname.startsWith("/api/hosted-apis/")) {
    if (/\/invoke$/.test(pathname)) return "hosted_api";
    if (/\/progress$/.test(pathname)) return "poll";
  }
  if (!pathname.startsWith("/api/shared-links/")) return null;
  if (/\/run$/.test(pathname)) return "llm";
  if (/\/progress$/.test(pathname)) return "poll";
  if (/\/client-step$/.test(pathname)) return "default";
  return "public";
}

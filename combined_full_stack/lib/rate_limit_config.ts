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
  | "upload"
  | "shared_run"
  | "hosted_api"
  | "landing_demo_build"
  | "landing_demo_signup"
  | "landing_demo_replay"
  | "shared_upload";
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
  // AI : authenticated doc upload — parse/OCR/storage is expensive; cap well below the default bucket.
  upload: { windowMs: 60_000, max: 30 },
  // AI : per-link + IP — limits anonymous credit drain on sharer_pays links.
  // AI : TODO security — IP rotation still drains owner credits; pair with CAPTCHA / spend caps.
  shared_run: { windowMs: 600_000, max: 5 },
  // AI : bearer-key pipeline invoke — per-api + IP cap.
  hosted_api: { windowMs: 600_000, max: 30 },
  // AI : landing pipeline builds — budget-gated; IP capped alongside budget.
  landing_demo_build: { windowMs: 600_000, max: 12 },
  // AI : landing email signup — low volume gate before demo use.
  landing_demo_signup: { windowMs: 600_000, max: 20 },
  // AI : landing rrweb chunk flush — frequent small posts.
  landing_demo_replay: { windowMs: 60_000, max: 40 },
  // AI : per-link session uploads — caps storage exhaustion on public shared links.
  shared_upload: { windowMs: 600_000, max: 10 },
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
  // AI : SECURITY — public demo preview reads; tighter than authenticated read tier.
  if (pathname === "/api/demo/state") return "public";
  if (pathname === "/api/demo/runs") return "public";
  if (/^\/api\/demo\/docs\/[^/]+\/text$/.test(pathname)) return "public";
  if (pathname.startsWith("/api/hosted-apis/")) {
    if (/\/invoke$/.test(pathname)) return "hosted_api";
    if (/\/progress$/.test(pathname)) return "poll";
  }
  if (!pathname.startsWith("/api/shared-links/")) return null;
  if (/\/run$/.test(pathname)) return "llm";
  if (/\/progress$/.test(pathname)) return "poll";
  // AI : SECURITY — resume is as expensive as a run; share the shared_run bucket.
  if (/\/client-step$/.test(pathname)) return "shared_run";
  if (/\/docs$/.test(pathname)) return "shared_upload";
  if (/\/docs\/[^/]+\/(text|file)$/.test(pathname)) return "read";
  return "public";
}

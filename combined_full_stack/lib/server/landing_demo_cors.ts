// AI : CORS for landing page → app API calls.

const ALLOWED_ORIGINS = new Set([
  "https://www.spine-ai.dev",
  "https://spine-ai.dev",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  return false;
}

export function landingDemoCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function withLandingDemoCors(req: Request, init?: ResponseInit): ResponseInit {
  return {
    ...init,
    headers: { ...landingDemoCorsHeaders(req), ...(init?.headers ?? {}) },
  };
}

import { NextResponse } from "next/server";

// AI : CORS for landing page → app API calls.
// AI : DONE (jank-cors-app-origin) — spine-ai-app.dev is the live app host (landing CSP/proxy).
// AI : TODO (jank-site-urls) — auto-pipeline.dev is a leftover alias; keep until DNS is gone.

const ALLOWED_ORIGINS = new Set([
  "https://www.spine-ai.dev",
  "https://spine-ai.dev",
  "https://www.spine-ai-app.dev",
  "https://spine-ai-app.dev",
  "https://www.auto-pipeline.dev",
  "https://auto-pipeline.dev",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);

export function isLandingDemoAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  return false;
}

export function landingDemoCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  if (!isLandingDemoAllowedOrigin(origin)) return {};
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

export function landingDemoJson(req: Request, body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: landingDemoCorsHeaders(req) });
}

export function landingDemoOptions(req: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: landingDemoCorsHeaders(req) });
}

export async function landingDemoRateLimited(req: Request, limited: NextResponse): Promise<NextResponse> {
  return NextResponse.json(await limited.json(), {
    status: limited.status,
    headers: { ...landingDemoCorsHeaders(req), ...Object.fromEntries(limited.headers.entries()) },
  });
}

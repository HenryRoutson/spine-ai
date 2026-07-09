import { NextRequest, NextResponse } from "next/server";
import { checkLandingProxyRateLimit, clientIpFromRequest } from "@/lib/rate_limit";

type SpineApiUrl = string;

const LANDING_PROXY_CLIENT_IP_HEADER = "x-spine-client-ip";
const LANDING_PROXY_SECRET_HEADER = "x-spine-proxy-secret";

function spineApiUrl(): SpineApiUrl {
  return (
    process.env.SPINE_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://www.spine-ai-app.dev")
  ).replace(/\/$/, "");
}

function unreachableError(host: SpineApiUrl): string {
  return `Couldn't reach the Spine app at ${host}. The landing page calls that server to build your pipeline — start it from combined_full_stack (npm run dev, usually port 3000). If the app runs elsewhere, set SPINE_API_URL on the landing page to match.`;
}

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const ip = clientIpFromRequest(req.headers);
  const limited = checkLandingProxyRateLimit(ip);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests — try again shortly.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const host = spineApiUrl();
  const url = `${host}/api/landing-demo/build-pipeline`;
  const proxySecret = process.env.LANDING_DEMO_PROXY_SECRET?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [LANDING_PROXY_CLIENT_IP_HEADER]: ip,
  };
  if (proxySecret) headers[LANDING_PROXY_SECRET_HEADER] = proxySecret;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: await req.text(),
    });
    // AI : pass through NDJSON token stream (or JSON error bodies) without buffering.
    const contentType = res.headers.get("Content-Type") ?? "application/json";
    if (!res.body) {
      const body = await res.text();
      return new NextResponse(body, {
        status: res.status,
        headers: { "Content-Type": contentType },
      });
    }
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-transform",
        // AI : disable proxy buffering so LLM token deltas reach the browser live.
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json({ error: unreachableError(host) }, { status: 502 });
  }
}

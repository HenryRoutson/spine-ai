// AI : shared landing → Spine app proxy helpers — used by all /api/landing-demo/* routes.

import { NextResponse } from "next/server";
import {
  LANDING_PROXY_CLIENT_IP_HEADER,
  LANDING_PROXY_SECRET_HEADER,
} from "@shared/landing-proxy/headers";
import { clientIpFromHeaders } from "@shared/rate-limit/client-ip";

type SpineApiUrl = string;
type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function spineApiUrl(): SpineApiUrl {
  return (
    process.env.SPINE_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://www.spine-ai-app.dev")
  ).replace(/\/$/, "");
}

export function clientIpFromRequest(headers: Headers): string {
  return clientIpFromHeaders(headers, "127.0.0.1");
}

function proxyHeaders(ip: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [LANDING_PROXY_CLIENT_IP_HEADER]: ip,
  };
  const proxySecret = process.env.LANDING_DEMO_PROXY_SECRET?.trim();
  if (proxySecret) headers[LANDING_PROXY_SECRET_HEADER] = proxySecret;
  return headers;
}

function unreachableError(host: SpineApiUrl, detail?: string): string {
  const base = `Couldn't reach the Spine app at ${host}.`;
  return detail ? `${base} ${detail}` : base;
}

function landingDemoProxyAuthError(host: SpineApiUrl): string {
  const hasSecret = Boolean(process.env.LANDING_DEMO_PROXY_SECRET?.trim());
  if (!hasSecret) {
    return `Landing demo proxy is not configured. Set LANDING_DEMO_PROXY_SECRET in the repo root .env (and on both Vercel projects: landing page + Spine app). The landing page at ${host.replace(/\/$/, "")} rejected the request without a matching proxy secret.`;
  }
  return `Landing demo proxy secret mismatch. Use the same LANDING_DEMO_PROXY_SECRET on the landing page and Spine app (currently calling ${host.replace(/\/$/, "")}).`;
}

function proxyResponseError(status: number, body: string, host: SpineApiUrl): string | null {
  if (status !== 401) return null;
  try {
    const data = JSON.parse(body) as { error?: string };
    if (data.error === "unauthorized") return landingDemoProxyAuthError(host);
  } catch {
    /* non-JSON 401 */
  }
  return null;
}

export async function proxyLandingDemoPost(
  req: Request,
  opts: {
    path: string;
    checkRateLimit: (ip: string) => RateLimitResult;
    stream?: boolean;
    unreachableDetail?: string;
  },
): Promise<Response> {
  const ip = clientIpFromRequest(req.headers);
  const limited = opts.checkRateLimit(ip);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests — try again shortly.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const host = spineApiUrl();
  const url = `${host}${opts.path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: proxyHeaders(ip),
      body: await req.text(),
    });
    const contentType = res.headers.get("Content-Type") ?? "application/json";
    if (opts.stream && res.ok && res.body) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache, no-transform",
          // AI : disable proxy buffering so LLM token deltas reach the browser live.
          "X-Accel-Buffering": "no",
        },
      });
    }
    const body = await res.text();
    const proxyError = proxyResponseError(res.status, body, host);
    if (proxyError) {
      return NextResponse.json({ error: proxyError }, { status: 502 });
    }
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  } catch {
    return NextResponse.json(
      { error: unreachableError(host, opts.unreachableDetail) },
      { status: 502 },
    );
  }
}

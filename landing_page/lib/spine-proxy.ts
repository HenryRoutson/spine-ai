// AI : shared landing → Spine app proxy helpers — used by all /api/landing-demo/* routes.

import { NextResponse } from "next/server";
import {
  LANDING_PROXY_CLIENT_IP_HEADER,
  LANDING_PROXY_SECRET_HEADER,
} from "@shared/landing-proxy/headers";
import { clientIpFromHeaders } from "@shared/rate-limit/client-ip";

type SpineApiUrl = string;
type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };
type landing_proxy_auth_failure =
  | "proxy_secret_not_configured"
  | "proxy_header_missing"
  | "proxy_secret_mismatch";

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

// AI : bracket access — avoids Next inlining undefined when the Vercel env was added after build.
function landingProxySecret(): string | undefined {
  const trimmed = process.env["LANDING_DEMO_PROXY_SECRET"]?.trim();
  return trimmed || undefined;
}

function isHostedDeploy(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function proxyHeaders(ip: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [LANDING_PROXY_CLIENT_IP_HEADER]: ip,
  };
  const proxySecret = landingProxySecret();
  if (proxySecret) headers[LANDING_PROXY_SECRET_HEADER] = proxySecret;
  return headers;
}

function unreachableError(host: SpineApiUrl, detail?: string): string {
  const base = `Couldn't reach the Spine app at ${host}.`;
  return detail ? `${base} ${detail}` : base;
}

function landingDemoProxyAuthError(
  host: SpineApiUrl,
  code?: landing_proxy_auth_failure | string,
): string {
  const target = host.replace(/\/$/, "");
  if (code === "proxy_secret_not_configured") {
    return `Spine app at ${target} has no LANDING_DEMO_PROXY_SECRET. Set the same value on both Vercel projects (landing page + Spine app), then redeploy both.`;
  }
  if (code === "proxy_header_missing") {
    return `Landing page did not send the proxy secret to ${target}. Set LANDING_DEMO_PROXY_SECRET on the landing-page Vercel project (same value as Spine), then redeploy.`;
  }
  if (code === "proxy_secret_mismatch") {
    return `LANDING_DEMO_PROXY_SECRET mismatch between landing page and Spine (${target}). Use the identical value on both Vercel projects, then redeploy both.`;
  }
  if (!landingProxySecret()) {
    return `Landing demo proxy is not configured. Set LANDING_DEMO_PROXY_SECRET on both Vercel projects (landing page + Spine app), then redeploy both. Currently calling ${target}.`;
  }
  return `Landing demo proxy secret rejected by ${target}. Use the same LANDING_DEMO_PROXY_SECRET on the landing page and Spine app, then redeploy both.`;
}

function proxyResponseError(status: number, body: string, host: SpineApiUrl): string | null {
  if (status !== 401) return null;
  try {
    const data = JSON.parse(body) as { error?: string; code?: string };
    if (data.error === "unauthorized") return landingDemoProxyAuthError(host, data.code);
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

  // AI : fail closed before calling Spine — missing secret is the usual prod 401 root cause.
  if (isHostedDeploy() && !landingProxySecret()) {
    return NextResponse.json(
      {
        error: landingDemoProxyAuthError(spineApiUrl()),
        code: "proxy_secret_not_configured",
      },
      { status: 502 },
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

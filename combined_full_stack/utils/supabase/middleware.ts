import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_SIGN_IN_REQUIRED } from "@/lib/auth-messages";
import { isPublicApiPath } from "@/lib/api-routes";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate_limit";
import { type RateLimitKey, publicApiTier } from "@/lib/rate_limit_config";
import { HTTP } from "@/lib/server/api-errors";
import { frameAncestorsCsp, isEmbedLinkId, normalizeEmbedOrigins } from "@/lib/server/embed_origins";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import { sanitizeRedirectPath } from "@/utils/sanitize_redirect";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/run",
  "/embed",
  "/site",
  "/demo",
  "/privacy",
  "/terms",
  "/cookies",
  "/accessibility",
  "/json-viewer.html",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicApiPathLocal(pathname: string, method: string): boolean {
  return isPublicApiPath(pathname, method);
}

function copySessionCookies(from: NextResponse, to: NextResponse): void {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
}

// AI : per-embed frame-ancestors via REST (Edge-safe — avoid supabase-js/ws in proxy).
async function fetchEmbedAllowedOrigins(embedId: string): Promise<string[]> {
  const env = getSupabasePublicEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!env || !serviceKey) return [];
  try {
    const url = new URL(`${env.url}/rest/v1/shared_links`);
    url.searchParams.set("id", `eq.${embedId}`);
    url.searchParams.set("revoked", "eq.false");
    url.searchParams.set("select", "allowed_origins");
    const res = await fetch(url.toString(), {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ allowed_origins?: string[] | null }>;
    return normalizeEmbedOrigins((rows[0]?.allowed_origins ?? []).map(String));
  } catch {
    return [];
  }
}

async function applyEmbedFrameHeaders(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const match = request.nextUrl.pathname.match(/^\/embed\/((?:emb|pub)_[a-z0-9]+)$/i);
  if (!match) return response;
  const embedId = match[1]!;
  let origins = await fetchEmbedAllowedOrigins(embedId);
  if (origins.length === 0 && isEmbedLinkId(embedId)) {
    origins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ];
  }
  const ancestors = origins.length > 0 ? frameAncestorsCsp(origins) : "frame-ancestors 'none'";
  const existing = response.headers.get("Content-Security-Policy");
  if (existing) {
    const without = existing
      .split(";")
      .map((p) => p.trim())
      .filter((p) => p && !p.toLowerCase().startsWith("frame-ancestors"));
    response.headers.set("Content-Security-Policy", [...without, ancestors].join("; "));
  } else {
    response.headers.set("Content-Security-Policy", ancestors);
  }
  response.headers.delete("X-Frame-Options");
  return response;
}

function redirectUnauthenticated(
  request: NextRequest,
  pathname: string,
  sessionResponse: NextResponse,
): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  const redirectResponse = NextResponse.redirect(loginUrl);
  copySessionCookies(sessionResponse, redirectResponse);
  return redirectResponse;
}

async function publicApiRateLimit(request: NextRequest, pathname: string): Promise<NextResponse | null> {
  const tier = publicApiTier(pathname);
  if (!tier) return null;
  const ip = clientIpFromHeaders(request.headers);
  const key = `ip:${ip}:${tier}` as RateLimitKey;
  const hit = await checkRateLimit(key, tier);
  if (hit.ok) return null;
  // AI : include path + tier so prod consoles aren't just "keys:1 Failed to load resource 429".
  return NextResponse.json(
    {
      error: `Too many requests for ${pathname} (tier: ${tier}) — retry in ${hit.retryAfterSec}s.`,
      code: "rate_limited",
      detail: `resource=${pathname} tier=${tier} retryAfterSec=${hit.retryAfterSec}`,
      resource: pathname,
      tier,
      retryAfterSec: hit.retryAfterSec,
    },
    { status: HTTP.TOO_MANY_REQUESTS, headers: { "Retry-After": String(hit.retryAfterSec) } },
  );
}

// AI : refreshes expired auth tokens, rewrites session cookies, and gates pages behind sign-in.
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isPublic = isPublicPath(pathname);

  if (isApiRoute && isPublicApiPathLocal(pathname, request.method)) {
    const limited = await publicApiRateLimit(request, pathname);
    if (limited) return limited;
  }

  const supabaseEnv = getSupabasePublicEnv();
  if (!supabaseEnv) {
    // AI : Edge middleware often inlines NODE_ENV=production even in `next dev`. Use Vercel as the deploy signal.
    if (!process.env.VERCEL) {
      const bare = NextResponse.next({ request });
      if (pathname.startsWith("/embed/")) return applyEmbedFrameHeaders(request, bare);
      return bare;
    }
    // AI : missing Vercel env vars must not crash proxy — gate pages, block protected APIs.
    if (isApiRoute && !isPublicApiPathLocal(pathname, request.method)) {
      return NextResponse.json(
        { error: "Supabase env missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on Vercel" },
        { status: 503 },
      );
    }
    if (!isApiRoute && !isPublic) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const bare = NextResponse.next({ request });
    if (pathname.startsWith("/embed/")) return applyEmbedFrameHeaders(request, bare);
    return bare;
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([headerName, headerValue]) =>
          supabaseResponse.headers.set(headerName, headerValue),
        );
      },
    },
  });

  // AI : getClaims() revalidates the JWT — required so Vercel proxy and browser stay in sync.
  // AI : when claims are missing (timeout or empty), fall back to cookie session so flaky Auth ≠ signed-out.
  let user: { sub?: string } | null = null;
  let authProbeFailed = false;
  try {
    const { data } = await supabase.auth.getClaims();
    user = data?.claims ?? null;
  } catch {
    authProbeFailed = true;
  }
  if (!user) {
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;
    if (sessionUser) user = { sub: sessionUser.id };
    else if (authProbeFailed) {
      /* keep user null — API path returns 503 below */
    }
  }

  if (!user && isApiRoute && !isPublicApiPathLocal(pathname, request.method)) {
    if (authProbeFailed) {
      return NextResponse.json(
        { error: "Auth temporarily unavailable — retry shortly." },
        { status: HTTP.UNAVAILABLE },
      );
    }
    return NextResponse.json({ error: AUTH_SIGN_IN_REQUIRED }, { status: 401 });
  }

  if (!user && !isApiRoute && !isPublic) {
    return redirectUnauthenticated(request, pathname, supabaseResponse);
  }

  if (user && pathname === "/login") {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = sanitizeRedirectPath(request.nextUrl.searchParams.get("next"));
    nextUrl.searchParams.delete("next");
    const redirectResponse = NextResponse.redirect(nextUrl);
    copySessionCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  if (pathname.startsWith("/embed/")) {
    return applyEmbedFrameHeaders(request, supabaseResponse);
  }

  return supabaseResponse;
}

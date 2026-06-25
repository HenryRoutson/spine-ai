import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_SIGN_IN_REQUIRED } from "@/lib/auth-messages";
import { PUBLIC_API_PATHS } from "@/lib/api-routes";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import { sanitizeRedirectPath } from "@/utils/sanitize_redirect";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function copySessionCookies(from: NextResponse, to: NextResponse): void {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
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

// AI : refreshes expired auth tokens, rewrites session cookies, and gates pages behind sign-in.
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isPublic = isPublicPath(pathname);

  const supabaseEnv = getSupabasePublicEnv();
  if (!supabaseEnv) {
    // AI : missing Vercel env vars must not crash proxy — gate pages, block protected APIs.
    if (isApiRoute && !isPublicApiPath(pathname)) {
      return NextResponse.json(
        { error: "Supabase env missing — set NEXT_PUBLIC_SUPABASE_URL and key on Vercel" },
        { status: 503 },
      );
    }
    if (!isApiRoute && !isPublic) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
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
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user && isApiRoute && !isPublicApiPath(pathname)) {
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

  return supabaseResponse;
}

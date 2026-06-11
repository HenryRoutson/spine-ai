import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/utils/supabase/env";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectUnauthenticated(request: NextRequest, pathname: string): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

// AI : refreshes expired auth tokens, rewrites session cookies, and gates pages behind sign-in.
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isPublic = isPublicPath(pathname);

  const supabaseEnv = getSupabasePublicEnv();
  if (!supabaseEnv) {
    // AI : missing Vercel env vars must not crash proxy — gate pages, let /login render.
    if (!isApiRoute && !isPublic) {
      return redirectUnauthenticated(request, pathname);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([headerName, headerValue]) =>
          response.headers.set(headerName, headerValue),
        );
      },
    },
  });

  // AI : getUser() (not getSession()) — revalidates the JWT and triggers the refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isApiRoute && !isPublic) {
    return redirectUnauthenticated(request, pathname);
  }

  if (user && pathname === "/login") {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = request.nextUrl.searchParams.get("next") || "/";
    nextUrl.searchParams.delete("next");
    return NextResponse.redirect(nextUrl);
  }

  return response;
}

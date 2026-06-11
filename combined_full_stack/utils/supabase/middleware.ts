import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

type supabase_url_string = string;
type supabase_key_string = string;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function getSupabaseEnv(): { url: supabase_url_string | undefined; key: supabase_key_string | undefined } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  return { url, key };
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

  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    // AI : missing Vercel env vars must not crash proxy — gate pages, let /login render.
    if (!isApiRoute && !isPublic) {
      return redirectUnauthenticated(request, pathname);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
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

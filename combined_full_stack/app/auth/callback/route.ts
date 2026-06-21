import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import { getSiteUrl } from "@/utils/supabase/site_url";
import { sanitizeRedirectPath } from "@/utils/sanitize_redirect";

// AI : OAuth redirect target — exchanges the provider code for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirectPath(searchParams.get("next"));
  const env = getSupabasePublicEnv();
  const siteUrl = getSiteUrl();

  if (code && env) {
    const response = NextResponse.redirect(`${siteUrl}${next}`);
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([headerName, headerValue]) =>
            response.headers.set(headerName, headerValue),
          );
        },
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth`);
}

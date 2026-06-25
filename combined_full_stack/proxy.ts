import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // AI : skip static assets + metadata routes (favicon, icon, sitemap) — auth must not gate them.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

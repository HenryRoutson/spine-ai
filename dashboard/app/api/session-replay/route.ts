import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSessionCookieValid, SESSION_COOKIE } from "@/lib/auth";
import { fetchDashboardSessionReplays } from "@/lib/dashboard_session_replay";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  if (!isSessionCookieValid(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? undefined;
  const sessions = await fetchDashboardSessionReplays(userId);
  return NextResponse.json({ sessions });
}

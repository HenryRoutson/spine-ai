import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchDashboardStats } from "@/lib/dashboard_stats";
import { fetchTimelineStats } from "@/lib/dashboard_timeline";
import { isSessionCookieValid, SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  if (!isSessionCookieValid(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? undefined;
  const [stats, timeline] = await Promise.all([
    fetchDashboardStats(),
    fetchTimelineStats(userId),
  ]);
  return NextResponse.json({ ...stats, timeline });
}

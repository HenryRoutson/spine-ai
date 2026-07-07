import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchDashboardStats } from "@/lib/dashboard_stats";
import { isSessionCookieValid, SESSION_COOKIE } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  if (!isSessionCookieValid(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const stats = await fetchDashboardStats();
  return NextResponse.json(stats);
}

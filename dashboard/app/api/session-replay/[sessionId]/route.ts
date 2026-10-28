import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSessionCookieValid, SESSION_COOKIE } from "@/lib/auth";
import {
  fetchDashboardSessionReplayEvents,
  type session_id_string,
} from "@/lib/dashboard_session_replay";

type route_ctx = { params: Promise<{ sessionId: string }> };

export async function GET(_req: Request, ctx: route_ctx) {
  const cookieStore = await cookies();
  if (!isSessionCookieValid(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await ctx.params;
  const events = await fetchDashboardSessionReplayEvents(sessionId as session_id_string);
  return NextResponse.json({ sessionId, events });
}

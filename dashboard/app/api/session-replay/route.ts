import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSessionCookieValid, SESSION_COOKIE } from "@/lib/auth";
import {
  fetchDashboardReplayFilterOptions,
  fetchDashboardReplayUserOptions,
  fetchDashboardSessionReplays,
  parseDashboardReplayComponent,
  type dashboard_replay_sort,
} from "@/lib/dashboard_session_replay";

function parseSort(raw: string | null): dashboard_replay_sort {
  if (raw === "clicks_desc" || raw === "clicks_asc" || raw === "component") return raw;
  return "recent";
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  if (!isSessionCookieValid(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? undefined;
  const userSearch = url.searchParams.get("userSearch") ?? undefined;
  const sourceRaw = url.searchParams.get("source");
  const source =
    sourceRaw === "app" || sourceRaw === "landing" ? sourceRaw : ("all" as const);
  const page = url.searchParams.get("page") ?? undefined;
  const component = parseDashboardReplayComponent(url.searchParams.get("component"));
  const sort = parseSort(url.searchParams.get("sort"));

  const [sessions, users, filterOptions] = await Promise.all([
    fetchDashboardSessionReplays({ userId, userSearch, source, page, component, sort }),
    fetchDashboardReplayUserOptions(),
    fetchDashboardReplayFilterOptions(),
  ]);
  return NextResponse.json({ sessions, users, filterOptions });
}

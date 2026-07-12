import type {
  rrweb_event_json,
  session_id_string,
  session_replay_clicked_component_label,
  session_replay_source,
} from "@shared/session-replay/types";
import { createAdminClient } from "./supabase_admin";

export type { rrweb_event_json, session_id_string };

export type dashboard_replay_sort = "recent" | "clicks_desc" | "clicks_asc" | "component";

export type dashboard_replay_source_filter = session_replay_source | "all";

export type dashboard_replay_component_filter =
  | "all"
  | session_replay_clicked_component_label;

export type dashboard_session_replay_query = {
  userId?: string;
  userSearch?: string;
  source?: dashboard_replay_source_filter;
  page?: string;
  component?: session_replay_clicked_component_label;
  sort?: dashboard_replay_sort;
  limit?: number;
};

export type dashboard_session_replay_row = {
  id: session_id_string;
  userId: string | null;
  userEmail: string | null;
  projectId: string | null;
  source: session_replay_source;
  startedAt: string;
  endedAt: string | null;
  eventCount: number;
  chunkCount: number;
  clickCount: number;
  pages: string[];
  clickedComponents: string[];
};

export type dashboard_replay_user_option = {
  userId: string | null;
  userEmail: string | null;
  sessionCount: number;
};

export type dashboard_replay_filter_options = {
  pages: string[];
  components: session_replay_clicked_component_label[];
};

const REPLAY_SELECT_LANDING =
  "id,user_id,user_email,demo_email,project_id,source,started_at,ended_at,event_count,chunk_count";
const REPLAY_SELECT_FULL = `${REPLAY_SELECT_LANDING},click_count,pages,clicked_components`;
const REPLAY_SELECT_BASE =
  "id,user_id,user_email,project_id,started_at,ended_at,event_count,chunk_count";

function mapReplayRow(r: Record<string, unknown>): dashboard_session_replay_row {
  const source: session_replay_source = r.source === "landing" ? "landing" : "app";
  const email =
    (r.user_email as string | null) ??
    (r.demo_email as string | null) ??
    null;
  return {
    id: r.id as session_id_string,
    userId: (r.user_id as string | null) ?? null,
    userEmail: email,
    projectId: (r.project_id as string | null) ?? null,
    source,
    startedAt: r.started_at as string,
    endedAt: (r.ended_at as string | null) ?? null,
    eventCount: Number(r.event_count ?? 0),
    chunkCount: Number(r.chunk_count ?? 0),
    clickCount: Number(r.click_count ?? 0),
    pages: (r.pages as string[] | null) ?? [],
    clickedComponents: (r.clicked_components as string[] | null) ?? [],
  };
}

function isMissingLandingColumns(message: string): boolean {
  return (
    message.includes("demo_email") ||
    message.includes("session_replay_sessions.source") ||
    (message.includes("column") && message.includes("does not exist"))
  );
}

function isMissingClickFilterColumns(message: string): boolean {
  return (
    message.includes("click_count") ||
    message.includes("clicked_components") ||
    (message.includes("column") && message.includes("does not exist"))
  );
}

function matchesUserSearch(row: dashboard_session_replay_row, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  if (row.userId?.toLowerCase().includes(q)) return true
  if (row.userEmail?.toLowerCase().includes(q)) return true
  return false
}

function matchesPageFilter(row: dashboard_session_replay_row, page: string): boolean {
  const q = page.trim().toLowerCase()
  if (!q) return true
  return row.pages.some((p) => p.toLowerCase().includes(q))
}

function matchesComponentFilter(
  row: dashboard_session_replay_row,
  component: session_replay_clicked_component_label,
): boolean {
  const q = component.trim().toLowerCase()
  if (!q) return true
  return row.clickedComponents.some((c) => c.toLowerCase() === q)
}

export function parseDashboardReplayComponent(
  raw: string | null,
): session_replay_clicked_component_label | undefined {
  const trimmed = raw?.trim()
  if (!trimmed || trimmed === "all") return undefined
  return trimmed as session_replay_clicked_component_label
}

function applySort(rows: dashboard_session_replay_row[], sort: dashboard_replay_sort): dashboard_session_replay_row[] {
  const copy = [...rows]
  if (sort === "clicks_desc") {
    copy.sort((a, b) => b.clickCount - a.clickCount || b.startedAt.localeCompare(a.startedAt))
  } else if (sort === "clicks_asc") {
    copy.sort((a, b) => a.clickCount - b.clickCount || a.startedAt.localeCompare(b.startedAt))
  } else if (sort === "component") {
    copy.sort((a, b) => {
      const ac = a.clickedComponents[0] ?? ""
      const bc = b.clickedComponents[0] ?? ""
      const byComponent = ac.localeCompare(bc)
      return byComponent !== 0 ? byComponent : b.startedAt.localeCompare(a.startedAt)
    })
  } else {
    copy.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }
  return copy
}

export function sortDashboardReplaySessions(
  rows: dashboard_session_replay_row[],
  sort: dashboard_replay_sort = "recent",
): dashboard_session_replay_row[] {
  return applySort(rows, sort)
}

export async function fetchDashboardSessionReplays(
  query: dashboard_session_replay_query = {},
): Promise<dashboard_session_replay_row[]> {
  const admin = await createAdminClient();
  if (!admin) return [];

  const limit = query.limit ?? 100;
  const sort = query.sort ?? "recent";

  const run = async (select: string, withClickFilters: boolean) => {
    let q = admin.from("session_replay_sessions").select(select).limit(limit * 3);
    if (query.userId) q = q.eq("user_id", query.userId);
    if (query.source === "app") q = q.eq("source", "app");
    if (query.source === "landing") q = q.eq("source", "landing");
    if (withClickFilters && query.component?.trim()) {
      q = q.contains("clicked_components", [query.component.trim()]);
    }
    if (withClickFilters && query.page?.trim() && !query.page.includes("%")) {
      // AI : exact path match via GIN when no wildcard semantics requested.
      q = q.contains("pages", [query.page.trim()]);
    }
    if (withClickFilters) {
      if (sort === "clicks_desc") q = q.order("click_count", { ascending: false });
      else if (sort === "clicks_asc") q = q.order("click_count", { ascending: true });
      else if (sort === "component") q = q.order("clicked_components", { ascending: true });
      else q = q.order("started_at", { ascending: false });
    } else {
      q = q.order("started_at", { ascending: false });
    }
    return q;
  };

  let { data, error } = await run(REPLAY_SELECT_FULL, true);
  if (error && isMissingClickFilterColumns(error.message)) {
    ({ data, error } = await run(REPLAY_SELECT_LANDING, false));
  }
  if (error && isMissingLandingColumns(error.message)) {
    console.warn("dashboard session_replay_sessions: falling back without landing columns:", error.message);
    const fallback = await run(REPLAY_SELECT_BASE, false);
    if (fallback.error) {
      console.warn("dashboard session_replay_sessions:", fallback.error.message);
      return [];
    }
    data = fallback.data;
    error = null;
  }
  if (error) {
    console.warn("dashboard session_replay_sessions:", error.message);
    return [];
  }

  let rows = (data ?? []).map((r) => mapReplayRow(r as unknown as Record<string, unknown>));
  if (query.userSearch?.trim()) {
    rows = rows.filter((r) => matchesUserSearch(r, query.userSearch!));
  }
  if (query.page?.trim()) {
    rows = rows.filter((r) => matchesPageFilter(r, query.page!));
  }
  if (query.component?.trim()) {
    rows = rows.filter((r) => matchesComponentFilter(r, query.component!));
  }
  rows = applySort(rows, sort);
  return rows.slice(0, limit);
}

export async function fetchDashboardReplayFilterOptions(): Promise<dashboard_replay_filter_options> {
  const admin = await createAdminClient();
  if (!admin) return { pages: [], components: [] };

  const { data, error } = await admin
    .from("session_replay_sessions")
    .select("pages,clicked_components")
    .order("started_at", { ascending: false })
    .limit(500);

  if (error && isMissingClickFilterColumns(error.message)) {
    return { pages: [], components: [] };
  }
  if (error) {
    console.warn("dashboard replay filter options:", error.message);
    return { pages: [], components: [] };
  }

  const pages = new Set<string>();
  const components = new Set<string>();
  for (const row of data ?? []) {
    for (const p of (row.pages as string[] | null) ?? []) pages.add(p);
    for (const c of (row.clicked_components as string[] | null) ?? []) components.add(c);
  }
  return {
    pages: [...pages].sort((a, b) => a.localeCompare(b)),
    components: [...components].sort((a, b) => a.localeCompare(b)) as session_replay_clicked_component_label[],
  };
}

export async function fetchDashboardReplayUserOptions(): Promise<dashboard_replay_user_option[]> {
  const admin = await createAdminClient();
  if (!admin) return [];

  const first = await admin
    .from("session_replay_sessions")
    .select("user_id,user_email,demo_email")
    .order("started_at", { ascending: false })
    .limit(500);

  let rows: Record<string, unknown>[] | null = (first.data ?? null) as Record<string, unknown>[] | null;
  let usersError = first.error;
  if (usersError && isMissingLandingColumns(usersError.message)) {
    const fallback = await admin
      .from("session_replay_sessions")
      .select("user_id,user_email")
      .order("started_at", { ascending: false })
      .limit(500);
    rows = (fallback.data ?? null) as Record<string, unknown>[] | null;
    usersError = fallback.error;
  }

  if (usersError) {
    console.warn("dashboard replay users:", usersError.message);
    return [];
  }

  const map = new Map<string, dashboard_replay_user_option>();
  for (const row of rows ?? []) {
    const userId = (row.user_id as string | null) ?? null;
    const userEmail =
      (row.user_email as string | null) ??
      (row.demo_email as string | null) ??
      null;
    const key = userId ?? userEmail ?? "anonymous";
    const existing = map.get(key);
    if (existing) {
      existing.sessionCount += 1;
      continue;
    }
    map.set(key, { userId, userEmail, sessionCount: 1 });
  }
  return [...map.values()].sort((a, b) => {
    const ae = a.userEmail ?? a.userId ?? "";
    const be = b.userEmail ?? b.userId ?? "";
    return ae.localeCompare(be);
  });
}

export async function fetchDashboardSessionReplayEvents(
  sessionId: session_id_string,
): Promise<rrweb_event_json[]> {
  const admin = await createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("session_replay_chunks")
    .select("chunk_index,events")
    .eq("session_id", sessionId)
    .order("chunk_index", { ascending: true });

  if (error) {
    console.warn("dashboard session_replay_chunks:", error.message);
    return [];
  }

  const out: rrweb_event_json[] = [];
  for (const row of data ?? []) {
    const events = row.events as rrweb_event_json[];
    if (Array.isArray(events)) out.push(...events);
  }
  return out;
}

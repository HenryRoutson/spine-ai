import { createAdminClient } from "./supabase_admin";

export type session_id_string = string & { __brand: "session_id" };

export type dashboard_session_replay_row = {
  id: session_id_string;
  userId: string | null;
  userEmail: string | null;
  projectId: string | null;
  source: "app" | "landing";
  startedAt: string;
  endedAt: string | null;
  eventCount: number;
  chunkCount: number;
};

export type rrweb_event_json = Record<string, unknown>;

export async function fetchDashboardSessionReplays(
  userId?: string,
  limit = 50,
): Promise<dashboard_session_replay_row[]> {
  const admin = await createAdminClient();
  if (!admin) return [];

  let query = admin
    .from("session_replay_sessions")
    .select("id,user_id,user_email,demo_email,project_id,source,started_at,ended_at,event_count,chunk_count")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) {
    console.warn("dashboard session_replay_sessions:", error.message);
    return [];
  }

  return (data ?? []).map((r) => {
    const source = r.source === "landing" ? "landing" : "app";
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
    };
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

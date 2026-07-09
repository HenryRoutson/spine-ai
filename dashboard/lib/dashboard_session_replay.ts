import type { rrweb_event_json, session_id_string } from "@shared/session-replay/types";
import { createAdminClient } from "./supabase_admin";

export type { rrweb_event_json, session_id_string };

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

// AI : base columns always present; landing cols (demo_email/source) may lag migrations.
const REPLAY_SELECT_FULL =
  "id,user_id,user_email,demo_email,project_id,source,started_at,ended_at,event_count,chunk_count";
const REPLAY_SELECT_BASE =
  "id,user_id,user_email,project_id,started_at,ended_at,event_count,chunk_count";

function mapReplayRow(r: Record<string, unknown>): dashboard_session_replay_row {
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
}

function isMissingLandingColumns(message: string): boolean {
  return (
    message.includes("demo_email") ||
    message.includes("session_replay_sessions.source") ||
    (message.includes("column") && message.includes("does not exist"))
  );
}

export async function fetchDashboardSessionReplays(
  userId?: string,
  limit = 50,
): Promise<dashboard_session_replay_row[]> {
  const admin = await createAdminClient();
  if (!admin) return [];

  const run = async (select: string) => {
    let query = admin
      .from("session_replay_sessions")
      .select(select)
      .order("started_at", { ascending: false })
      .limit(limit);
    if (userId) query = query.eq("user_id", userId);
    return query;
  };

  const { data, error } = await run(REPLAY_SELECT_FULL);
  if (!error) {
    return (data ?? []).map((r) => mapReplayRow(r as unknown as Record<string, unknown>));
  }

  // AI : landing migration not applied yet — fall back so app replays still list.
  if (isMissingLandingColumns(error.message)) {
    console.warn("dashboard session_replay_sessions: falling back without landing columns:", error.message);
    const fallback = await run(REPLAY_SELECT_BASE);
    if (fallback.error) {
      console.warn("dashboard session_replay_sessions:", fallback.error.message);
      return [];
    }
    return (fallback.data ?? []).map((r) => mapReplayRow(r as unknown as Record<string, unknown>));
  }

  console.warn("dashboard session_replay_sessions:", error.message);
  return [];
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

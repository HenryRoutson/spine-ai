import {
  countClicksInRrwebEvents,
  mergeUniqueStrings,
  pagesFromRrwebMetaEvents,
} from "@shared/session-replay/click-stats";
import type { rrweb_event_json, session_id_string, session_replay_summary } from "@/lib/session-replay-types";
import { createAdminClient } from "./supabase_admin";
import type { user_id_string } from "./require_auth";

export type session_replay_source = "app" | "landing";

export type session_replay_row = session_replay_summary & { userId: user_id_string };

export type session_replay_chunk_meta = {
  pages?: string[];
  clickedComponents?: string[];
};

export type session_replay_chunk_input = {
  sessionId: session_id_string;
  userId: user_id_string;
  userEmail?: string | null;
  projectId?: string | null;
  chunkIndex: number;
  events: rrweb_event_json[];
  isFinal?: boolean;
  pages?: string[];
  clickedComponents?: string[];
};

// AI : anonymous landing-page rrweb — no auth.users row; keyed by demo email + ip hash.
export type landing_session_replay_chunk_input = {
  sessionId: session_id_string;
  demoEmail: string;
  ipHash: string;
  projectId?: string | null;
  chunkIndex: number;
  events: rrweb_event_json[];
  isFinal?: boolean;
  pages?: string[];
  clickedComponents?: string[];
};

const MAX_EVENTS_PER_CHUNK = 200;
const MAX_CHUNK_BYTES = 1_500_000;

function isMissingReplayTable(error: { message?: string }): boolean {
  const msg = error.message ?? "";
  return msg.includes("session_replay") || msg.includes("schema cache");
}

function isMissingClickFilterColumns(message: string): boolean {
  return (
    message.includes("click_count") ||
    message.includes("clicked_components") ||
    (message.includes("column") && message.includes("pages"))
  );
}

function trimEvents(events: rrweb_event_json[]): rrweb_event_json[] {
  if (events.length > MAX_EVENTS_PER_CHUNK) return events.slice(0, MAX_EVENTS_PER_CHUNK);
  const raw = JSON.stringify(events);
  if (raw.length <= MAX_CHUNK_BYTES) return events;
  const trimmed: rrweb_event_json[] = [];
  let size = 2;
  for (const ev of events) {
    const part = JSON.stringify(ev);
    if (size + part.length + 1 > MAX_CHUNK_BYTES) break;
    trimmed.push(ev);
    size += part.length + 1;
  }
  return trimmed.length > 0 ? trimmed : events.slice(0, 1);
}

async function refreshSessionCounts(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  sessionId: session_id_string,
  opts: {
    projectId?: string | null;
    isFinal?: boolean;
    pages?: string[];
    clickedComponents?: string[];
  },
): Promise<void> {
  if (!admin) return;
  const { data: agg } = await admin
    .from("session_replay_chunks")
    .select("events")
    .eq("session_id", sessionId);
  const allEvents: rrweb_event_json[] = [];
  for (const row of agg ?? []) {
    const arr = row.events as rrweb_event_json[];
    if (Array.isArray(arr)) allEvents.push(...arr);
  }
  const { data: existing, error: existingError } = await admin
    .from("session_replay_sessions")
    .select("pages,clicked_components")
    .eq("id", sessionId)
    .maybeSingle();
  const existingPages =
    existingError || !existing ? [] : ((existing.pages as string[] | null) ?? []);
  const existingComponents =
    existingError || !existing ? [] : ((existing.clicked_components as string[] | null) ?? []);
  const pages = mergeUniqueStrings(
    existingPages,
    [...pagesFromRrwebMetaEvents(allEvents), ...(opts.pages ?? [])],
  );
  const clickedComponents = mergeUniqueStrings(existingComponents, opts.clickedComponents ?? []);
  const fullPatch: Record<string, unknown> = {
    event_count: allEvents.length,
    chunk_count: agg?.length ?? 0,
    click_count: countClicksInRrwebEvents(allEvents),
    pages,
    clicked_components: clickedComponents,
  };
  if (opts.projectId) fullPatch.project_id = opts.projectId;
  if (opts.isFinal) fullPatch.ended_at = new Date().toISOString();

  const { error: updateError } = await admin
    .from("session_replay_sessions")
    .update(fullPatch)
    .eq("id", sessionId);
  if (updateError && isMissingClickFilterColumns(updateError.message)) {
    const legacyPatch: Record<string, unknown> = {
      event_count: allEvents.length,
      chunk_count: agg?.length ?? 0,
    };
    if (opts.projectId) legacyPatch.project_id = opts.projectId;
    if (opts.isFinal) legacyPatch.ended_at = new Date().toISOString();
    await admin.from("session_replay_sessions").update(legacyPatch).eq("id", sessionId);
  }
}

async function upsertReplayChunk(
  admin: NonNullable<Awaited<ReturnType<typeof createAdminClient>>>,
  sessionId: session_id_string,
  chunkIndex: number,
  events: rrweb_event_json[],
  isFinal: boolean | undefined,
  projectId: string | null | undefined,
  meta?: session_replay_chunk_meta,
): Promise<void> {
  const trimmed = trimEvents(events);
  if (trimmed.length > 0) {
    const { error: chunkError } = await admin.from("session_replay_chunks").upsert(
      {
        session_id: sessionId,
        chunk_index: chunkIndex,
        events: trimmed,
      },
      { onConflict: "session_id,chunk_index" },
    );
    if (chunkError && !isMissingReplayTable(chunkError)) {
      console.warn("session_replay_chunks upsert failed:", chunkError.message);
      return;
    }
  }

  if (trimmed.length > 0 || isFinal || (meta?.pages?.length ?? 0) > 0 || (meta?.clickedComponents?.length ?? 0) > 0) {
    await refreshSessionCounts(admin, sessionId, {
      projectId,
      isFinal,
      pages: meta?.pages,
      clickedComponents: meta?.clickedComponents,
    });
  }
}

export class SessionReplayOwnershipError extends Error {
  constructor() {
    super("session replay ownership mismatch");
    this.name = "SessionReplayOwnershipError";
  }
}

export async function ingestSessionReplayChunk(input: session_replay_chunk_input): Promise<void> {
  const admin = await createAdminClient();
  if (!admin) return;

  // AI : SECURITY — never let a client-supplied sessionId steal another user's replay via service-role upsert.
  const { data: existing, error: existingError } = await admin
    .from("session_replay_sessions")
    .select("user_id,source")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (existingError && !isMissingReplayTable(existingError)) {
    console.warn("session_replay_sessions ownership check failed:", existingError.message);
    return;
  }
  if (existing) {
    if (existing.source === "landing" || (existing.user_id && existing.user_id !== input.userId)) {
      throw new SessionReplayOwnershipError();
    }
  }

  const { error: sessionError } = await admin.from("session_replay_sessions").upsert(
    {
      id: input.sessionId,
      user_id: input.userId,
      user_email: input.userEmail ?? null,
      project_id: input.projectId ?? null,
      source: "app" satisfies session_replay_source,
    },
    { onConflict: "id", ignoreDuplicates: false },
  );
  if (sessionError && !isMissingReplayTable(sessionError)) {
    console.warn("session_replay_sessions upsert failed:", sessionError.message);
    return;
  }

  await upsertReplayChunk(
    admin,
    input.sessionId,
    input.chunkIndex,
    input.events,
    input.isFinal,
    input.projectId,
    { pages: input.pages, clickedComponents: input.clickedComponents },
  );
}

export async function ingestLandingSessionReplayChunk(
  input: landing_session_replay_chunk_input,
): Promise<void> {
  const admin = await createAdminClient();
  if (!admin) return;

  // AI : SECURITY — refuse to overwrite an authenticated app session with anonymous landing ingest.
  const { data: existing, error: existingError } = await admin
    .from("session_replay_sessions")
    .select("user_id,source,demo_email")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (existingError && !isMissingReplayTable(existingError)) {
    console.warn("landing session_replay ownership check failed:", existingError.message);
    return;
  }
  if (existing) {
    if (existing.source === "app" || existing.user_id) {
      throw new SessionReplayOwnershipError();
    }
    if (existing.demo_email && existing.demo_email !== input.demoEmail) {
      throw new SessionReplayOwnershipError();
    }
  }

  const { error: sessionError } = await admin.from("session_replay_sessions").upsert(
    {
      id: input.sessionId,
      user_id: null,
      user_email: input.demoEmail,
      demo_email: input.demoEmail,
      ip_hash: input.ipHash,
      project_id: input.projectId ?? null,
      source: "landing" satisfies session_replay_source,
    },
    { onConflict: "id", ignoreDuplicates: false },
  );
  if (sessionError && !isMissingReplayTable(sessionError)) {
    console.warn("landing session_replay_sessions upsert failed:", sessionError.message);
    return;
  }

  await upsertReplayChunk(
    admin,
    input.sessionId,
    input.chunkIndex,
    input.events,
    input.isFinal,
    input.projectId,
    { pages: input.pages, clickedComponents: input.clickedComponents },
  );
}

export async function listSessionReplaysForUser(
  userId: user_id_string,
  limit = 40,
): Promise<session_replay_row[]> {
  const admin = await createAdminClient();
  if (!admin) return [];

  const selectFull =
    "id,user_id,user_email,project_id,started_at,ended_at,event_count,chunk_count,click_count,pages,clicked_components,source";
  const selectBase =
    "id,user_id,user_email,project_id,started_at,ended_at,event_count,chunk_count";

  const first = await admin
    .from("session_replay_sessions")
    .select(selectFull)
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  let rows: Record<string, unknown>[] | null = (first.data ?? null) as Record<string, unknown>[] | null;
  let listError = first.error;
  if (listError && isMissingClickFilterColumns(listError.message)) {
    const fallback = await admin
      .from("session_replay_sessions")
      .select(selectBase)
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(limit);
    rows = (fallback.data ?? null) as Record<string, unknown>[] | null;
    listError = fallback.error;
  }

  if (listError) {
    if (!isMissingReplayTable(listError)) console.warn("session_replay_sessions list failed:", listError.message);
    return [];
  }

  return (rows ?? []).map((row) => ({
    id: row.id as session_id_string,
    userId: row.user_id as user_id_string,
    userEmail: (row.user_email as string | null) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string | null) ?? null,
    eventCount: Number(row.event_count ?? 0),
    chunkCount: Number(row.chunk_count ?? 0),
    clickCount: Number(row.click_count ?? 0),
    pages: (row.pages as string[] | null) ?? [],
    clickedComponents: (row.clicked_components as string[] | null) ?? [],
    source: row.source === "landing" ? "landing" : "app",
  }));
}

export async function fetchSessionReplayEvents(sessionId: session_id_string): Promise<rrweb_event_json[]> {
  const admin = await createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("session_replay_chunks")
    .select("chunk_index,events")
    .eq("session_id", sessionId)
    .order("chunk_index", { ascending: true });

  if (error) {
    if (!isMissingReplayTable(error)) console.warn("session_replay_chunks fetch failed:", error.message);
    return [];
  }

  const out: rrweb_event_json[] = [];
  for (const row of data ?? []) {
    const events = row.events as rrweb_event_json[];
    if (Array.isArray(events)) out.push(...events);
  }
  return out;
}

// AI : shared session replay types — safe for client import without server deps.

export type session_id_string = string & { __brand: "session_id" };

export type rrweb_event_json = Record<string, unknown>;

export type session_replay_summary = {
  id: session_id_string;
  userId: string;
  userEmail: string | null;
  projectId: string | null;
  startedAt: string;
  endedAt: string | null;
  eventCount: number;
  chunkCount: number;
};

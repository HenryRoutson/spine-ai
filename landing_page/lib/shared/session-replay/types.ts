// AI : session replay types — safe for client/dashboard import without server deps.

export type session_id_string = string & { __brand: "session_id" }

export type rrweb_event_json = Record<string, unknown>

export type session_replay_source = "app" | "landing"

export type session_replay_clicked_component_label = string & {
  readonly __brand?: unique symbol
}

export type session_replay_summary = {
  id: session_id_string
  userId: string
  userEmail: string | null
  projectId: string | null
  startedAt: string
  endedAt: string | null
  eventCount: number
  chunkCount: number
  clickCount?: number
  pages?: string[]
  clickedComponents?: string[]
  source?: session_replay_source
}

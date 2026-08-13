// AI : Supabase Realtime as a port — React hook and CLI attach the same tables + overlay rules.

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import type { Project, PipelineRun } from "@/lib/types"

export const TEAM_REALTIME_CHANNEL = "team-shared-pointers"
export const TEAM_REALTIME_DEBOUNCE_MS = 400
export const TEAM_REALTIME_SCHEMA = "public"

export type realtime_table_t = "projects" | "docs" | "runs" | "team_members"
export type realtime_kind_t = "projects" | "runs" | "members"

export const TEAM_REALTIME_TABLES: readonly { table: realtime_table_t; kind: realtime_kind_t }[] = [
  { table: "projects", kind: "projects" },
  { table: "docs", kind: "projects" },
  { table: "runs", kind: "runs" },
  { table: "team_members", kind: "members" },
] as const

export type RealtimeEvent = {
  table: realtime_table_t
  kind: realtime_kind_t
  eventType: string
}

export type TeamRealtimeHandlers = {
  onProjectsChanged: () => void
  onRunsChanged: () => void
  onMembershipChanged: () => void
}

export type RealtimePort = {
  subscribe: (handler: (event: RealtimeEvent) => void) => () => void
}

export function kindForRealtimeTable(table: string): realtime_kind_t | null {
  const row = TEAM_REALTIME_TABLES.find((t) => t.table === table)
  return row?.kind ?? null
}

// AI : prod GET /api/state lags POST/DELETE (warm-instance + realtime). Never drop local creates or resurrect tombstones.
export function overlayOptimisticProjects(
  remote: Project[],
  created: ReadonlyMap<string, Project> | readonly Project[],
  deletedIds: ReadonlySet<string> | readonly string[],
): Project[] {
  const tombstones = deletedIds instanceof Set ? deletedIds : new Set(deletedIds)
  const createdList = created instanceof Map ? [...created.values()] : created
  const visible = remote.filter((p) => !tombstones.has(p.id))
  const ids = new Set(visible.map((p) => p.id))
  const pending: Project[] = []
  for (const p of createdList) {
    if (!ids.has(p.id) && !tombstones.has(p.id)) pending.push(p)
  }
  return [...pending, ...visible]
}

export function confirmCreatedInMap(created: Map<string, Project>, serverProjects: Project[]): void {
  for (const id of [...created.keys()]) {
    if (serverProjects.some((p) => p.id === id)) created.delete(id)
  }
}

export function overlayOptimisticRuns(
  remote: PipelineRun[],
  deletedRunIds: ReadonlySet<string> | readonly string[] = [],
): PipelineRun[] {
  const tombstones = deletedRunIds instanceof Set ? deletedRunIds : new Set(deletedRunIds)
  return remote.filter((r) => !tombstones.has(r.id))
}

export function debounceRealtime(fn: () => void, ms = TEAM_REALTIME_DEBOUNCE_MS): () => void {
  if (ms <= 0) return fn
  let timer: ReturnType<typeof setTimeout> | null = null
  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn()
    }, ms)
  }
}

export function attachRealtimePort(port: RealtimePort, handlers: TeamRealtimeHandlers, debounceMs = TEAM_REALTIME_DEBOUNCE_MS): () => void {
  const bumpProjects = debounceRealtime(handlers.onProjectsChanged, debounceMs)
  const bumpRuns = debounceRealtime(handlers.onRunsChanged, debounceMs)
  const bumpMembers = debounceRealtime(handlers.onMembershipChanged, debounceMs)
  return port.subscribe((event) => {
    if (event.kind === "projects") bumpProjects()
    else if (event.kind === "runs") bumpRuns()
    else bumpMembers()
  })
}

export function createMemoryRealtimePort(): RealtimePort & { emit: (event: RealtimeEvent) => void } {
  const listeners = new Set<(event: RealtimeEvent) => void>()
  return {
    subscribe(handler) {
      listeners.add(handler)
      return () => {
        listeners.delete(handler)
      }
    },
    emit(event) {
      for (const listener of listeners) listener(event)
    },
  }
}

type ChannelLike = {
  on: (
    event: string,
    filter: { event: string; schema: string; table: string },
    callback: (payload: { table?: string; eventType?: string }) => void,
  ) => ChannelLike
  subscribe: () => unknown
}

export function subscribeTeamRealtimeChannel(
  channel: ChannelLike,
  onEvent: (event: RealtimeEvent) => void,
): ChannelLike {
  let next: ChannelLike = channel
  for (const spec of TEAM_REALTIME_TABLES) {
    next = next.on(
      "postgres_changes",
      { event: "*", schema: TEAM_REALTIME_SCHEMA, table: spec.table },
      (payload) => {
        onEvent({
          table: spec.table,
          kind: spec.kind,
          eventType: payload.eventType ?? "*",
        })
      },
    )
  }
  next.subscribe()
  return next
}

export async function createSupabaseRealtimePort(
  client: Pick<SupabaseClient, "channel" | "removeChannel">,
): Promise<{ port: RealtimePort; channel: RealtimeChannel }> {
  const memory = createMemoryRealtimePort()
  const channel = subscribeTeamRealtimeChannel(
    client.channel(TEAM_REALTIME_CHANNEL) as unknown as ChannelLike,
    (event) => memory.emit(event),
  ) as unknown as RealtimeChannel
  return {
    port: {
      subscribe(handler) {
        const stop = memory.subscribe(handler)
        return () => {
          stop()
          void client.removeChannel(channel)
        }
      },
    },
    channel,
  }
}

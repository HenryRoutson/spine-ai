import { describe, expect, it, vi } from "vitest"
import {
  overlayOptimisticProjects,
  confirmCreatedInMap,
  createMemoryRealtimePort,
  attachRealtimePort,
  subscribeTeamRealtimeChannel,
  TEAM_REALTIME_TABLES,
  TEAM_REALTIME_CHANNEL,
  kindForRealtimeTable,
} from "@/lib/core/realtime"
import { createSpineSession } from "@/lib/core/session"
import type { Project, ProjectId } from "@/lib/types"

function project(id: string, name: string): Project {
  return {
    id: id as ProjectId,
    name,
    kind: "blank",
    models: [],
    modules: [],
    strategies: [],
  }
}

describe("realtime overlay (shared with React store)", () => {
  it("keeps local creates when a stale remote snapshot omits them", () => {
    const local = project("p_local", "Mine")
    const merged = overlayOptimisticProjects([], [local], [])
    expect(merged.map((p) => p.id)).toEqual(["p_local"])
  })

  it("does not resurrect tombstones when realtime still lists a deleted id", () => {
    const gone = project("p_gone", "Deleted")
    const kept = project("p_kept", "Kept")
    const merged = overlayOptimisticProjects([gone, kept], [], ["p_gone"])
    expect(merged.map((p) => p.id)).toEqual(["p_kept"])
  })

  it("confirmCreatedInMap drops pending once the server lists the id", () => {
    const created = new Map<string, Project>([["p_1", project("p_1", "A")]])
    confirmCreatedInMap(created, [project("p_1", "A")])
    expect(created.size).toBe(0)
  })

  it("session ingestRemoteProjects uses the same overlay as store.tsx", () => {
    const store = createSpineSession()
    const created = store.addProject({ open: true })
    store.ingestRemoteProjects([])
    expect(store.projects.some((p) => p.id === created.id)).toBe(true)
    expect(store.getSnapshot().pendingCreates.some((p) => p.id === created.id)).toBe(true)

    store.ingestRemoteProjects([created])
    expect(store.getSnapshot().pendingCreates).toHaveLength(0)

    store.deleteProject(created.id)
    store.ingestRemoteProjects([created])
    expect(store.projects.some((p) => p.id === created.id)).toBe(false)
  })

  it("attachRealtimePort maps projects/docs to onProjectsChanged after debounce", () => {
    vi.useFakeTimers()
    const bus = createMemoryRealtimePort()
    const hits = { projects: 0, runs: 0, members: 0 }
    const stop = attachRealtimePort(bus, {
      onProjectsChanged: () => {
        hits.projects += 1
      },
      onRunsChanged: () => {
        hits.runs += 1
      },
      onMembershipChanged: () => {
        hits.members += 1
      },
    }, 400)
    bus.emit({ table: "docs", kind: "projects", eventType: "INSERT" })
    bus.emit({ table: "projects", kind: "projects", eventType: "UPDATE" })
    expect(hits.projects).toBe(0)
    vi.advanceTimersByTime(400)
    expect(hits.projects).toBe(1)
    bus.emit({ table: "runs", kind: "runs", eventType: "*" })
    bus.emit({ table: "team_members", kind: "members", eventType: "*" })
    vi.advanceTimersByTime(400)
    expect(hits.runs).toBe(1)
    expect(hits.members).toBe(1)
    stop()
    vi.useRealTimers()
  })

  it("subscribeTeamRealtimeChannel binds the same tables as the React hook", () => {
    const seen: string[] = []
    const events: string[] = []
    const channel = {
      on(_event: "postgres_changes", filter: { table: string }, cb: (payload: { eventType?: string }) => void) {
        seen.push(filter.table)
        cb({ eventType: "INSERT" })
        return channel
      },
      subscribe() {
        return "ok"
      },
    }
    subscribeTeamRealtimeChannel(channel as never, (event) => events.push(`${event.table}:${event.kind}`))
    expect(seen).toEqual(TEAM_REALTIME_TABLES.map((t) => t.table))
    expect(events).toContain("projects:projects")
    expect(events).toContain("docs:projects")
    expect(events).toContain("runs:runs")
    expect(events).toContain("team_members:members")
    expect(TEAM_REALTIME_CHANNEL).toBe("team-shared-pointers")
    expect(kindForRealtimeTable("docs")).toBe("projects")
  })
})

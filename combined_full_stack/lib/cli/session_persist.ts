// AI : file-backed session so sequential `spine session` commands share the React-like store.
// AI : set SPINE_API_URL for pull/push/start-run against the same HTTP API as the GUI.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { PersistPort, SessionSnapshot } from "@/lib/core/types"
import { emptySessionSnapshot, migrateSessionChat } from "@/lib/core/session"
import type { Project } from "@/lib/types"

export const SPINE_SESSION_ENV = "SPINE_SESSION_PATH"
export const DEFAULT_SESSION_FILE = ".spine-session.json"

export function resolveSessionPath(flagPath?: string): string {
  return flagPath || process.env[SPINE_SESSION_ENV] || DEFAULT_SESSION_FILE
}

type SessionFile = Partial<SessionSnapshot> & { pendingCreateIds?: string[] }

function isProject(p: unknown): p is Project {
  return Boolean(p && typeof p === "object" && typeof (p as Project).id === "string" && Array.isArray((p as Project).modules))
}

// AI : pendingCreates on disk is extras-only; pendingCreateIds reconstitutes clones already in projects[].
export function hydratePendingCreates(projects: Project[], rawPending: unknown, rawIds?: unknown): Project[] {
  const extras = Array.isArray(rawPending) ? rawPending.filter(isProject) : []
  const ids = Array.isArray(rawIds) && rawIds.every((id) => typeof id === "string")
    ? (rawIds as string[])
    : extras.map((p) => p.id)
  const byId = new Map<string, Project>()
  for (const p of projects) byId.set(p.id, p)
  for (const p of extras) byId.set(p.id, p)
  const out: Project[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) continue
    const p = byId.get(id)
    if (!p) continue
    seen.add(id)
    out.push(p)
  }
  return out
}

function persistPendingCreates(snap: SessionSnapshot): { pendingCreates: Project[]; pendingCreateIds: string[] } {
  const inProjects = new Set(snap.projects.map((p) => p.id))
  return {
    pendingCreateIds: snap.pendingCreates.map((p) => p.id),
    pendingCreates: snap.pendingCreates.filter((p) => !inProjects.has(p.id)),
  }
}

export function createFilePersist(path: string): PersistPort {
  return {
    load() {
      if (!existsSync(path)) return emptySessionSnapshot()
      const raw = JSON.parse(readFileSync(path, "utf8")) as SessionFile
      const projects = raw.projects ?? []
      return {
        ...emptySessionSnapshot(),
        ...raw,
        projects,
        docs: raw.docs ?? [],
        docContents: raw.docContents ?? {},
        runs: raw.runs ?? [],
        pendingCreates: hydratePendingCreates(projects, raw.pendingCreates, raw.pendingCreateIds),
        deletedProjectIds: raw.deletedProjectIds ?? [],
        ...migrateSessionChat(raw),
        pendingProposal: raw.pendingProposal ?? null,
        assistantInFlight: raw.assistantInFlight ?? null,
        modelOptions: raw.modelOptions ?? [],
        billingRuns: raw.billingRuns ?? [],
        billingAccount: raw.billingAccount ?? null,
        earningsAccount: raw.earningsAccount ?? null,
        cacheEntries: raw.cacheEntries ?? [],
        saveError: raw.saveError ?? null,
        shareLinkIds: raw.shareLinkIds ?? [],
        hostedApiIds: raw.hostedApiIds ?? [],
        docProjectIds: raw.docProjectIds ?? {},
      }
    },
    save(snap) {
      mkdirSync(dirname(path) || ".", { recursive: true })
      const pending = persistPendingCreates(snap)
      writeFileSync(
        path,
        `${JSON.stringify({ ...snap, ...pending, chatByProjectId: snap.chatByProjectId ?? {} }, null, 2)}\n`,
      )
    },
  }
}

// AI : file-backed session so sequential `spine session` commands share the React-like store.
// AI : set SPINE_API_URL for pull/push/start-run against the same HTTP API as the GUI.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { PersistPort, SessionSnapshot } from "@/lib/core/types"
import { emptySessionSnapshot, migrateSessionChat } from "@/lib/core/session"

export const SPINE_SESSION_ENV = "SPINE_SESSION_PATH"
export const DEFAULT_SESSION_FILE = ".spine-session.json"

export function resolveSessionPath(flagPath?: string): string {
  return flagPath || process.env[SPINE_SESSION_ENV] || DEFAULT_SESSION_FILE
}

export function createFilePersist(path: string): PersistPort {
  return {
    load() {
      if (!existsSync(path)) return emptySessionSnapshot()
      const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<SessionSnapshot>
      return {
        ...emptySessionSnapshot(),
        ...raw,
        projects: raw.projects ?? [],
        docs: raw.docs ?? [],
        docContents: raw.docContents ?? {},
        runs: raw.runs ?? [],
        pendingCreates: raw.pendingCreates ?? [],
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
      writeFileSync(path, `${JSON.stringify(snap, null, 2)}\n`)
    },
  }
}

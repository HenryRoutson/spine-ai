// AI : file-backed session so sequential `spine session` commands share the React-like store.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { PersistPort, SessionSnapshot } from "@/lib/core/types"
import { DEFAULT_MODEL } from "@/lib/types"

export const SPINE_SESSION_ENV = "SPINE_SESSION_PATH"
export const DEFAULT_SESSION_FILE = ".spine-session.json"

function emptySnapshot(): SessionSnapshot {
  return {
    projects: [],
    docs: [],
    docContents: {},
    runs: [],
    activeProjectId: "",
    model: DEFAULT_MODEL,
    inferenceInputDocIds: {},
    pendingCreates: [],
    deletedProjectIds: [],
  }
}

export function resolveSessionPath(flagPath?: string): string {
  return flagPath || process.env[SPINE_SESSION_ENV] || DEFAULT_SESSION_FILE
}

export function createFilePersist(path: string): PersistPort {
  return {
    load() {
      if (!existsSync(path)) return emptySnapshot()
      const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<SessionSnapshot>
      return {
        ...emptySnapshot(),
        ...raw,
        projects: raw.projects ?? [],
        docs: raw.docs ?? [],
        docContents: raw.docContents ?? {},
        runs: raw.runs ?? [],
        pendingCreates: raw.pendingCreates ?? [],
        deletedProjectIds: raw.deletedProjectIds ?? [],
      }
    },
    save(snap) {
      mkdirSync(dirname(path) || ".", { recursive: true })
      writeFileSync(path, `${JSON.stringify(snap, null, 2)}\n`)
    },
  }
}

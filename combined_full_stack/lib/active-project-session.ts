import { appStorageKey } from "@/lib/storage-keys"
import { navigateToBuildWorkspace } from "@/lib/app-mode-nav"
import type { ProjectId } from "@/lib/types"

const KEY = appStorageKey("active-project-id")

export function readActiveProjectSession(): ProjectId | null {
  if (typeof window === "undefined") return null
  try {
    const v = sessionStorage.getItem(KEY)
    return v?.trim() ? (v as ProjectId) : null
  } catch {
    return null
  }
}

export function writeActiveProjectSession(id: ProjectId): void {
  sessionStorage.setItem(KEY, id)
}

export function clearActiveProjectSession(): void {
  sessionStorage.removeItem(KEY)
}

export function openProjectInWorkspace(id: ProjectId): void {
  writeActiveProjectSession(id)
  navigateToBuildWorkspace(id)
}

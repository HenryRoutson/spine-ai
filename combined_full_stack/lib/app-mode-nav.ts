import { clearActiveProjectSession, openProjectInWorkspace } from "@/lib/active-project-session"
import type { ProjectId } from "@/lib/types"

export type AppMode = "run" | "build"

// AI : full navigation on mode switch — store remounts cleanly (session + provider tree).
export function navigateToRunMode(): void {
  clearActiveProjectSession()
  window.location.assign("/")
}

export function navigateToBuildMode(): void {
  window.location.assign("/projects")
}

export function navigateToBuildWorkspace(projectId: ProjectId): void {
  openProjectInWorkspace(projectId)
}

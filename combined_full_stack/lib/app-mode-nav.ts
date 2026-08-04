import { clearActiveProjectSession } from "@/lib/active-project-session"
import type { ProjectId } from "@/lib/types"

type AppModeNavApi = {
  navigateToRunMode: () => void
  navigateToBuildMode: () => void
  navigateToProjectPicker: () => void
  openBuildWorkspace: (projectId: ProjectId) => void
}

let api: AppModeNavApi | null = null

export function registerAppModeNavApi(next: AppModeNavApi | null): void {
  api = next
}

// AI : client-side shell switches — no full document reload (store + panels stay warm).
export function navigateToRunMode(): void {
  if (api) {
    api.navigateToRunMode()
    return
  }
  clearActiveProjectSession()
  window.location.assign("/")
}

export function navigateToBuildMode(): void {
  if (api) {
    api.navigateToBuildMode()
    return
  }
  window.location.assign("/projects")
}

export function navigateToProjectPicker(): void {
  if (api) {
    api.navigateToProjectPicker()
    return
  }
  window.location.assign("/projects")
}

export function navigateToBuildWorkspace(projectId: ProjectId): void {
  if (api) {
    api.openBuildWorkspace(projectId)
    return
  }
  window.location.assign("/")
}

export type AppMode = "run" | "build"

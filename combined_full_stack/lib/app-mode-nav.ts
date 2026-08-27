import { clearActiveProjectSession } from "@/lib/active-project-session"
import { isDemoRoute } from "@/lib/demo-mode"
import { peekPendingPickerList, pickerHomeHref, writePendingPickerList, type picker_list_tab } from "@/lib/picker-list"
import type { ProjectId } from "@/lib/types"

type AppModeNavApi = {
  navigateToRunMode: () => void
  navigateToBuildMode: () => void
  navigateToProjectPicker: (tab?: picker_list_tab) => void
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
  if (isDemoRoute()) return
  clearActiveProjectSession()
  window.location.assign("/")
}

export function navigateToBuildMode(): void {
  if (api) {
    api.navigateToBuildMode()
    return
  }
  if (isDemoRoute()) return
  window.location.assign("/projects")
}

export function navigateToProjectPicker(tab?: picker_list_tab): void {
  const next = tab ?? peekPendingPickerList() ?? "pipelines"
  writePendingPickerList(next)
  if (api) {
    api.navigateToProjectPicker(next)
    return
  }
  if (isDemoRoute()) return
  window.location.assign(pickerHomeHref(next))
}

export function navigateToBuildWorkspace(projectId: ProjectId): void {
  if (api) {
    api.openBuildWorkspace(projectId)
    return
  }
  if (isDemoRoute()) return
  window.location.assign("/")
}

export enum AppMode {
  Run = "run",
  Build = "build",
}

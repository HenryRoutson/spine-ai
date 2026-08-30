import type { ProjectId } from "@/lib/types"

// AI : lets app-mode-nav switch shells without importing the store tree.
export type StoreNavigationBridge = {
  enterBuilder: (projectId: ProjectId) => void
  leaveBuilder: () => void
  enterPicker: () => void
  // AI : Lovable page-only site — builder chrome without a host pipeline.
  enterWebsiteStudio: () => void
}

let bridge: StoreNavigationBridge | null = null

export function registerStoreNavigationBridge(next: StoreNavigationBridge | null): void {
  bridge = next
}

export function getStoreNavigationBridge(): StoreNavigationBridge | null {
  return bridge
}

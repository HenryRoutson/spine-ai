import { clearActiveProjectSession } from "@/lib/active-project-session"
import { clearEarningsSnapshot } from "@/lib/earnings-snapshot-cache"
import { clearStateSnapshot } from "@/lib/state-snapshot-cache"

// AI : wipe per-tab workspace caches on sign-in/out so StoreProvider never hydrates another user's snapshot.
export function clearWorkspaceClientSession(): void {
  clearStateSnapshot()
  clearEarningsSnapshot()
  clearActiveProjectSession()
}

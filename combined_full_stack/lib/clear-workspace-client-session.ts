import { clearActiveProjectSession } from "@/lib/active-project-session"
import { clearBillingKeysSnapshot } from "@/lib/billing-keys-snapshot-cache"
import { clearBillingSnapshot } from "@/lib/billing-snapshot-cache"
import { clearEarningsSnapshot } from "@/lib/earnings-snapshot-cache"
import { clearMarketplaceSnapshot } from "@/lib/marketplace-snapshot-cache"
import { clearSettingsAccountSnapshot } from "@/lib/settings-account-snapshot-cache"
import { clearStateSnapshot } from "@/lib/state-snapshot-cache"
import { clearTeamsSnapshot } from "@/lib/teams-snapshot-cache"

// AI : wipe per-tab workspace caches on sign-in/out so StoreProvider never hydrates another user's snapshot.
export function clearWorkspaceClientSession(): void {
  clearStateSnapshot()
  clearBillingSnapshot()
  clearBillingKeysSnapshot()
  clearEarningsSnapshot()
  clearSettingsAccountSnapshot()
  clearTeamsSnapshot()
  clearMarketplaceSnapshot()
  clearActiveProjectSession()
}

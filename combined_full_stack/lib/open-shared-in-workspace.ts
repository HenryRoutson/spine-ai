import { queuePendingSharedRun } from "@/lib/pending-shared-run"
import { addSharedWithMe, type shared_link_id_string } from "@/lib/shared-with-me"

// AI : public /run pages bookmark the link then land in the full app shell (Billing tab available).
export function openSharedLinkInWorkspace(linkId: shared_link_id_string, name?: string): void {
  addSharedWithMe(linkId, name)
  queuePendingSharedRun(linkId)
  window.location.assign("/")
}

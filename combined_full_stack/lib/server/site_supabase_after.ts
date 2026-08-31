import { after } from "next/server"
import { isSiteLinkId } from "@/lib/hosted-site"
import type { HostedSiteAuth } from "@/lib/shared-link-types"
import { allocateSiteSupabase } from "./site_supabase"
import { logger } from "./server_logger"

const log = logger("site-supabase")

export function afterAllocateSiteSupabase(linkId: string, auth?: HostedSiteAuth): void {
  if (!isSiteLinkId(linkId)) return
  if (auth && auth.allocStatus !== "pending" && auth.allocStatus !== "error") return
  after(() => {
    void allocateSiteSupabase(linkId).catch((err) => {
      log.error("alloc failed", { linkId, error: (err as Error).message })
    })
  })
}

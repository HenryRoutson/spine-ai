import { isSiteLinkId } from "@/lib/hosted-site"
import {
  persistWebsitePipelineChange,
  listSharedLinksForOwner,
  revokeSharedLink,
} from "@/lib/server/shared_links"
import type { user_id_string } from "@/lib/server/require_auth"
import type { ProjectId } from "@/lib/server/types"
import type { pipeline_website_delete_action, website_dependent } from "@/lib/website-pipelines"
import {
  nextPrimaryProjectIdAfterUnbind,
  unbindProjectFromWebsite,
  websitesUsingProject,
} from "@/lib/website-pipelines"

export async function websitesDependingOnPipeline(
  ownerId: user_id_string,
  projectId: ProjectId,
): Promise<website_dependent[]> {
  const links = await listSharedLinksForOwner(ownerId)
  return websitesUsingProject(
    links.filter((link) => isSiteLinkId(link.id) && !link.revoked),
    projectId,
  )
}

export async function applyPipelineDeleteToOwnerWebsites(opts: {
  ownerId: user_id_string
  projectId: ProjectId
  websiteAction: pipeline_website_delete_action
}): Promise<website_dependent[]> {
  const links = await listSharedLinksForOwner(opts.ownerId)
  const sites = links.filter((link) => isSiteLinkId(link.id) && !link.revoked)
  const dependents = websitesUsingProject(sites, opts.projectId)
  for (const site of dependents) {
    if (opts.websiteAction === "delete") {
      await revokeSharedLink(opts.ownerId, site.id)
      continue
    }
    const full = sites.find((row) => row.id === site.id)
    if (!full) continue
    const siteOptions = unbindProjectFromWebsite(full.siteOptions, opts.projectId)
    await persistWebsitePipelineChange(opts.ownerId, full.id, {
      siteOptions,
      projectId: nextPrimaryProjectIdAfterUnbind(full.projectId, siteOptions, opts.projectId),
    })
  }
  return dependents
}

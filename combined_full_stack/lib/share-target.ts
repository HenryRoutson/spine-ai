// AI : share is workspace-level — pipeline vs website only changes which cards apply.

import { listedWebsitePipelineBindings } from "@/lib/website-pipelines"
import type { SharedLinkRecord } from "@/lib/shared-link-types"
import type { Project } from "@/lib/types"

export type share_target_kind = "pipeline" | "website"

export type ShareTarget =
  | { kind: "pipeline"; project: Project }
  | { kind: "website"; site: SharedLinkRecord; project?: Project | null }

export function shareTargetHasRunnableBackend(target: ShareTarget): boolean {
  if (target.kind === "pipeline") return target.project.modules.length > 0
  return listedWebsitePipelineBindings(target.site.siteOptions.pipelineBindings).length > 0
}

export function shareTargetShowsApi(target: ShareTarget): boolean {
  return target.kind === "pipeline"
}

export function shareTargetShowsFunding(target: ShareTarget): boolean {
  return shareTargetHasRunnableBackend(target)
}

export function shareTargetProjectId(target: ShareTarget): string {
  if (target.kind === "pipeline") return target.project.id
  return target.site.projectId || target.project?.id || ""
}

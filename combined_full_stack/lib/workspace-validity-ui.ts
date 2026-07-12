// AI : combined Structure → Pipeline → run-tab validity for sidebar nav + tab gates.
// AI : TODO (spec) — billing waterfall: red-disable Pipeline/Inference/Testing when balance below floor; unblock after top-up.
import { computeInvalidForUi } from "@/lib/pipeline-validity-ui"
import { typesInvalidForUi } from "@/lib/structure-validity-ui"
import type { AppWindowId } from "@/lib/app-shell"
import type { PipelineModule, StructureModel, TypeAlias } from "@/lib/types"
import { cn } from "@/lib/utils"

export type WorkspaceValidityIssue = "types" | "pipeline"

export type WorkspaceValidity = {
  typesInvalid: boolean
  pipelineInvalid: boolean
  pipelineEditingBlocked: boolean
  runTabsBlocked: boolean
}

export function computeWorkspaceValidity(
  modules: PipelineModule[],
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
  teamReadOnly = false,
): WorkspaceValidity {
  const typesInvalid = typesInvalidForUi(models, typeAliases)
  const pipelineInvalid = computeInvalidForUi(modules, models, typeAliases).size > 0
  return {
    typesInvalid,
    pipelineInvalid,
    pipelineEditingBlocked: typesInvalid || teamReadOnly,
    runTabsBlocked: typesInvalid || pipelineInvalid,
  }
}

const INVALID_NAV_TABS = new Set<AppWindowId>(["pipeline", "inference", "testing", "share"])

export function workspaceNavTabIssue(
  tabId: AppWindowId,
  validity: WorkspaceValidity,
): WorkspaceValidityIssue | null {
  if (!INVALID_NAV_TABS.has(tabId)) return null
  if (validity.typesInvalid) return "types"
  if (validity.pipelineInvalid) return "pipeline"
  return null
}

export function workspaceNavTabDisabled(tabId: AppWindowId, validity: WorkspaceValidity): boolean {
  return (tabId === "inference" || tabId === "testing" || tabId === "share") && validity.runTabsBlocked
}

export function workspaceNavTabTitle(
  tabId: AppWindowId,
  label: string,
  validity: WorkspaceValidity,
): string {
  const issue = workspaceNavTabIssue(tabId, validity)
  if (!issue) return label
  if (issue === "types") {
    return tabId === "pipeline"
      ? "Fix type errors in Structure before editing the pipeline"
      : "Fix type errors in Structure before running"
  }
  return tabId === "pipeline"
    ? "Fix pipeline validation errors"
    : "Fix pipeline errors before running"
}

export function workspaceNavTabButtonClass(
  isActive: boolean,
  issue: WorkspaceValidityIssue | null,
  disabled: boolean,
): string {
  if (!issue) {
    return isActive
      ? "bg-secondary text-foreground"
      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
  }
  return cn(
    disabled && "cursor-not-allowed",
    isActive
      ? "bg-destructive/10 text-destructive"
      : "text-destructive hover:bg-destructive/10 hover:text-destructive",
  )
}

export function workspaceNavTabIconClass(
  isActive: boolean,
  issue: WorkspaceValidityIssue | null,
): string {
  if (issue) return "text-destructive"
  return isActive ? "text-primary" : "text-muted-foreground"
}

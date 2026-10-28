// AI : parity ids — pipeline.validate
// AI : combined Structure → Pipeline → run-tab validity for sidebar nav + tab gates.
// AI : TODO (spec) — billing waterfall: red-disable Pipeline/Inference/Testing when balance below floor; unblock after top-up.
import { computeInvalidForUi } from "@/lib/pipeline-validity-ui"
import { migrateProjectModules } from "@/lib/quote-steps"
import { structureIssueMessagesForUi, typesInvalidForUi } from "@/lib/structure-validity-ui"
import { formatInvalidMapErrors } from "@/lib/validity"
import type { AppWindowId } from "@/lib/app-shell"
import { stripSharedModels } from "@/lib/structure"
import { ModuleKind, type PipelineModule, type Project, type StructureModel, type TypeAlias } from "@/lib/types"

export type WorkspaceValidityIssue = "types" | "pipeline"

export type WorkspaceValidity = {
  typesInvalid: boolean
  pipelineInvalid: boolean
  pipelineEmpty: boolean
  pipelineEditingBlocked: boolean
  runTabsBlocked: boolean
}

// AI : new-project skeleton (Input + Output, no user models) is unfinished — not a validation error.
// AI : ignore shared builtins (Document, QuoteSpan, …) — migrate/withSharedModels always injects them.
export function isEmptyStarterPipeline(
  modules: PipelineModule[],
  models: StructureModel[] = [],
): boolean {
  if (stripSharedModels(models).length > 0) return false
  return modules.every((m) => m.kind === ModuleKind.Input || m.kind === ModuleKind.Output)
}

export function computeWorkspaceValidity(
  modules: PipelineModule[],
  models: StructureModel[],
  typeAliases: TypeAlias[] = [],
  teamReadOnly = false,
): WorkspaceValidity {
  const typesInvalid = typesInvalidForUi(models, typeAliases)
  const pipelineEmpty = isEmptyStarterPipeline(modules, models)
  const pipelineInvalid = !pipelineEmpty && computeInvalidForUi(modules, models, typeAliases).size > 0
  return {
    typesInvalid,
    pipelineInvalid,
    pipelineEmpty,
    pipelineEditingBlocked: typesInvalid || teamReadOnly,
    runTabsBlocked: typesInvalid || pipelineInvalid,
  }
}

const INVALID_NAV_TABS = new Set<AppWindowId>(["pipeline", "inference", "testing", "schedule", "share"])

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
  return (tabId === "inference" || tabId === "testing" || tabId === "schedule" || tabId === "share") && validity.runTabsBlocked
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

export function workspaceNavTabIconClass(
  isActive: boolean,
  issue: WorkspaceValidityIssue | null,
): string {
  if (issue) return "text-destructive"
  return isActive ? "text-primary" : "text-muted-foreground"
}

// AI : short list-row copy — first structure or pipeline issue blocking a run.
export function projectRunBlockReason(project: Project): string | null {
  const migrated = migrateProjectModules(project)
  const modules = migrated.modules
  const models = migrated.models
  const typeAliases = project.typeAliases ?? []

  if (isEmptyStarterPipeline(modules, models)) return "Pipeline is empty"

  const structureMsgs = structureIssueMessagesForUi(models, typeAliases)
  if (structureMsgs.length > 0) return structureMsgs[0]

  const invalid = computeInvalidForUi(modules, models, typeAliases)
  if (invalid.size === 0) return null

  const formatted = formatInvalidMapErrors(invalid, modules, models)
  const firstLine = formatted.split("\n").find((line) => line.trim())
  return firstLine?.replace(/^- /, "") ?? "Pipeline validation errors"
}

export function projectRunBlocked(project: Project): boolean {
  const migrated = migrateProjectModules(project)
  const validity = computeWorkspaceValidity(
    migrated.modules,
    migrated.models,
    project.typeAliases ?? [],
    !!project.teamReadOnly,
  )
  return validity.runTabsBlocked || validity.pipelineEmpty
}

// AI : pure project list ops shared by SpineSession + useStore (parity.md §8.5 thin-store).

import type { ProjectPatch } from "@/lib/core/types"
import type { SessionSnapshot } from "@/lib/core/types"
import { AUTHORED_PROJECT_KIND } from "@/lib/project-assistant-types"
import { stripBuiltinTypeAliases, stripSharedModels, withBuiltinTypeAliases, withSharedModels } from "@/lib/structure"
import { syncManagedPipelineSteps } from "@/lib/structure-parse-steps"
import type { PipelineModule, Project, ProjectId, StructureModel, TypeAlias } from "@/lib/types"

export type renamed_name = string

// AI : returns null when no change (empty name or same name).
export function renamedProjects(
  projects: Project[],
  id: ProjectId | string,
  name: renamed_name,
): Project[] | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const current = projects.find((p) => p.id === id)
  if (!current || current.name === trimmed) return null
  return projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p))
}

export function withProjectDocumentation(project: Project, text: string): Project {
  const documentation = text.trim() ? text : undefined
  if (project.documentation === documentation) return project
  return { ...project, documentation }
}

// AI : same applyProjectChanges patch as SpineSession + useStore (blank→authored when models appear).
export function projectPatchFromChanges(
  project: Project,
  changes: ProjectPatch,
  globalModel: string,
): Partial<Project> | null {
  if (
    !changes.models &&
    !changes.modules &&
    !changes.typeAliases &&
    changes.documentation === undefined &&
    !changes.name
  ) {
    return null
  }
  const nextModels = changes.models ? stripSharedModels(changes.models) : project.models
  const modelsForSync = withSharedModels(nextModels)
  const nextModules = changes.modules
    ? syncManagedPipelineSteps(changes.modules, modelsForSync, globalModel)
    : changes.models
      ? syncManagedPipelineSteps(project.modules, modelsForSync, globalModel)
      : undefined
  const leaveBlank = project.kind === "blank" && nextModels.length > 0
  return {
    ...(changes.models ? { models: nextModels } : {}),
    ...(changes.typeAliases ? { typeAliases: stripBuiltinTypeAliases(changes.typeAliases) } : {}),
    ...(nextModules !== undefined ? { modules: nextModules } : {}),
    ...(changes.documentation !== undefined ? { documentation: changes.documentation || undefined } : {}),
    ...(changes.name ? { name: changes.name } : {}),
    ...(leaveBlank ? { kind: AUTHORED_PROJECT_KIND } : {}),
  }
}

// AI : GUI setModels syncs managed pipeline steps — SpineSession must match (parity.md §8.5).
export function modelsPatchWithSync(
  project: Project,
  models: StructureModel[] | ((prev: StructureModel[]) => StructureModel[]),
  globalModel: string,
): Partial<Project> {
  const prev = stripSharedModels(project.models)
  const raw = typeof models === "function" ? models(withSharedModels(prev)) : models
  const nextModels = stripSharedModels(raw)
  return {
    models: nextModels,
    modules: syncManagedPipelineSteps(project.modules, withSharedModels(nextModels), globalModel),
  }
}

export function typeAliasesPatch(
  project: Project,
  aliases: TypeAlias[] | ((prev: TypeAlias[]) => TypeAlias[]),
): Partial<Project> {
  const prev = stripBuiltinTypeAliases(project.typeAliases ?? [])
  const raw = typeof aliases === "function" ? aliases(withBuiltinTypeAliases(prev)) : aliases
  return { typeAliases: stripBuiltinTypeAliases(raw) }
}

export function modulesPatchWithSync(
  project: Project,
  modules: PipelineModule[],
  globalModel: string,
): Partial<Project> {
  return { modules: syncManagedPipelineSteps(modules, project.models, globalModel) }
}

// AI : merge a patch into one project row — shared by SpineSession.patchProject + useStore.patchProject.
export function patchProjectInList(
  projects: Project[],
  projectId: string,
  patch: Partial<Project>,
): Project[] {
  return projects.map((p) => (p.id === projectId ? { ...p, ...patch } : p))
}

// AI : same delete rules as SpineSession.deleteProject — store can adopt when thin-wrap completes.
export function deleteProjectSnapshot(snap: SessionSnapshot, id: string): SessionSnapshot {
  const deletedProjectIds = snap.deletedProjectIds.includes(id)
    ? snap.deletedProjectIds
    : [...snap.deletedProjectIds, id]
  const projects = snap.projects.filter((p) => p.id !== id)
  const pendingCreates = snap.pendingCreates.filter((p) => p.id !== id)
  const activeProjectId = snap.activeProjectId === id ? (projects[0]?.id ?? "") : snap.activeProjectId
  const { [id]: _dropped, ...chatByProjectId } = snap.chatByProjectId
  return {
    ...snap,
    projects,
    pendingCreates,
    deletedProjectIds,
    activeProjectId,
    chatByProjectId,
    chat: (activeProjectId && chatByProjectId[activeProjectId]) || [],
  }
}

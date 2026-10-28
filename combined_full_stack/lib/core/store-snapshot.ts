// AI : map GUI store pieces → SessionSnapshot so React can call to*View without a second SpineSession.
// AI : TODO (arch-thin-store) — full useStore wrap; this is the ViewModel bridge only (parity.md §8.5).

import { emptySessionSnapshot } from "@/lib/core/session"
import type { SessionSnapshot } from "@/lib/core/types"
import type { DocRef, PipelineModule, Project, StructureModel, TypeAlias } from "@/lib/types"

export type StoreSnapshotParts = {
  projects: Project[]
  activeProjectId: string
  docs?: DocRef[]
  documentation?: string
  modules?: PipelineModule[]
  models?: StructureModel[]
  typeAliases?: TypeAlias[]
  model?: string
  inferenceInputDocIds?: SessionSnapshot["inferenceInputDocIds"]
}

// AI : build a snapshot for ViewModels — overlays active project's docs markdown when provided.
export function sessionSnapshotFromStore(parts: StoreSnapshotParts): SessionSnapshot {
  const base = emptySessionSnapshot()
  const projects = parts.projects.map((p) => {
    if (p.id !== parts.activeProjectId) return p
    return {
      ...p,
      ...(parts.documentation != null ? { documentation: parts.documentation } : {}),
      ...(parts.modules ? { modules: parts.modules } : {}),
      ...(parts.models ? { models: parts.models } : {}),
      ...(parts.typeAliases ? { typeAliases: parts.typeAliases } : {}),
    }
  })
  return {
    ...base,
    projects,
    activeProjectId: parts.activeProjectId,
    docs: parts.docs ?? base.docs,
    model: parts.model ?? base.model,
    inferenceInputDocIds: parts.inferenceInputDocIds ?? base.inferenceInputDocIds,
  }
}

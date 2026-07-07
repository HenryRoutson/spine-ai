import {
  buildDefaultInputDocs,
  inputDocsByModuleFromAssignment,
  orderedInputModules,
  resolveInputDocs,
} from "@/lib/inference-input"
import type { DocId, DocRef, ModuleId, Project } from "@/lib/types"

// AI : default input docs for shared links / hosted APIs — mirrors inference assignment.
export function shareDefaultDocsByModule(
  project: Project,
  docs: DocRef[],
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>,
): Partial<Record<ModuleId, DocId[]>> {
  const inputModules = orderedInputModules(project.modules)
  const savedByModule = inputDocsByModuleFromAssignment(
    inputModules,
    resolveInputDocs(docs, project, inputModules, inferenceInputDocIds),
  )
  const missingModules = inputModules.filter((m) => !savedByModule[m.id]?.length)
  const defaultByModule = inputDocsByModuleFromAssignment(
    missingModules,
    missingModules.length ? buildDefaultInputDocs(docs, project, missingModules) : {},
  )

  const out: Partial<Record<ModuleId, DocId[]>> = {}
  for (const m of inputModules) {
    const ids = savedByModule[m.id]?.length ? savedByModule[m.id]! : defaultByModule[m.id]
    if (ids?.length) out[m.id] = ids
  }
  return out
}

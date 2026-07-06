import { orderedInputModules } from "@/lib/inference-input"
import { DocLabel, type DocId, type DocRef, type ModuleId, type Project } from "@/lib/types"

// AI : default input docs for shared links / hosted APIs — mirrors inference assignment.
export function shareDefaultDocsByModule(
  project: Project,
  docs: DocRef[],
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>,
): Partial<Record<ModuleId, DocId[]>> {
  const inputModules = orderedInputModules(project.modules)
  const out: Partial<Record<ModuleId, DocId[]>> = {}
  for (const m of inputModules) {
    const raw = inferenceInputDocIds[m.id]
    if (raw) {
      out[m.id] = Array.isArray(raw) ? raw : [raw]
      continue
    }
    const seeded = docs.filter((d) => d.label === DocLabel.Inference).slice(0, 1)
    if (seeded.length) out[m.id] = [seeded[0].id]
  }
  return out
}

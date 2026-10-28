// AI : structures that a function step actually names — not "compatible type" suggestions.
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { typeExprRefModelId } from "@/lib/server/type_expr"
import type { ModuleId, PipelineModule, StructureModelId } from "@/lib/types"

export type structure_step_link = {
  moduleId: ModuleId
  label: string
  role: "in" | "out"
}

export function stepsUsingStructure(
  modules: PipelineModule[],
  modelId: StructureModelId,
): structure_step_link[] {
  const out: structure_step_link[] = []
  for (const m of flattenPipelineModules(modules)) {
    const inId = m.inStructureId ?? (m.inType ? typeExprRefModelId(m.inType) : undefined)
    const outId = m.outStructureId ?? (m.outType ? typeExprRefModelId(m.outType) : undefined)
    if (inId === modelId) out.push({ moduleId: m.id, label: m.label, role: "in" })
    if (outId === modelId && inId !== modelId) out.push({ moduleId: m.id, label: m.label, role: "out" })
  }
  return out
}

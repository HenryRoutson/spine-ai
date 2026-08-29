// AI : local/control steps skip the billed LLM input gate unless the author opts in.
import { InputType, ModuleKind, type PipelineModule } from "@/lib/types"

export function inputDescriptionLlmOptInOnly(kind: PipelineModule["kind"] | string): boolean {
  return (
    kind === ModuleKind.IfElse ||
    kind === ModuleKind.Case ||
    kind === ModuleKind.ControlJoin ||
    kind === ModuleKind.CustomCode ||
    kind === ModuleKind.N8n ||
    kind === ModuleKind.Connect
  )
}

export function shouldCheckInputDescription(
  m: Pick<PipelineModule, "kind" | "inputType" | "inputDescription" | "checkInputDescription">,
): boolean {
  if (!m.inputDescription?.trim()) return false
  if (m.checkInputDescription === false) return false
  if (inputDescriptionLlmOptInOnly(m.kind)) return m.checkInputDescription === true
  if (m.kind === ModuleKind.Input) {
    const types = !m.inputType ? [] : Array.isArray(m.inputType) ? m.inputType : [m.inputType]
    if (types.length > 0 && types.every((t) => t === InputType.Json || t === InputType.Excel)) return false
  }
  return true
}

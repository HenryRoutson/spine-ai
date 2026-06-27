import { INPUT_TYPES, type DocRef, type InputType, type InputTypeSpec, type ModuleId, type PipelineModule } from "@/lib/types"

export type InputDocsAssignment = Partial<Record<ModuleId, DocRef | DocRef[]>>

export function inputMinCountForModule(inputModule: PipelineModule): number {
  return Math.max(1, inputModule.inputMinCount ?? 1)
}

export function isMultiDocInputModule(inputModule: PipelineModule): boolean {
  return inputModule.kind === "input" && (inputMinCountForModule(inputModule) > 1 || !!inputModule.outIsList)
}

export function docsForInputModule(assignment: InputDocsAssignment, moduleId: ModuleId): DocRef[] {
  const v = assignment[moduleId]
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

export function moduleInputReady(inputModule: PipelineModule, assignment: InputDocsAssignment): boolean {
  return docsForInputModule(assignment, inputModule.id).length >= inputMinCountForModule(inputModule)
}

export function inputTypesForModule(inputModule: PipelineModule): InputType[] {
  if (!inputModule.inputType) return []
  return Array.isArray(inputModule.inputType) ? inputModule.inputType : [inputModule.inputType]
}

export function inputTypesNeedOcr(types: InputType[]): boolean {
  return types.includes("pdf") || types.includes("image")
}

export function inputModuleNeedsOcr(inputModule: PipelineModule): boolean {
  return inputModule.kind === "input" && inputTypesNeedOcr(inputTypesForModule(inputModule))
}

export function upstreamInputModule(
  module: PipelineModule,
  modules: PipelineModule[],
): PipelineModule | undefined {
  const idx = modules.findIndex((m) => m.id === module.id)
  for (let i = idx - 1; i >= 0; i--) {
    const m = modules[i]
    if (m?.kind === "input") return m
  }
  return undefined
}

export function inputNameRestrictionLabel(inputModule: PipelineModule): string | undefined {
  const s = inputModule.inputNameContains?.trim()
  return s || undefined
}

export function orderedInputModules(modules: PipelineModule[]): PipelineModule[] {
  return modules.filter((m) => m.kind === "input")
}

export function inputTypeLabel(type?: InputTypeSpec): string {
  if (!type) return "file"
  const types = Array.isArray(type) ? type : [type]
  const labels = types.map((t) => INPUT_TYPES.find((x) => x.value === t)?.label ?? t)
  if (labels.length <= 2) return labels.join(" or ")
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
}

const FILE_ACCEPT: Partial<Record<InputType, string>> = {
  pdf: ".pdf",
  word: ".doc,.docx",
  excel: ".xls,.xlsx,.csv",
  json: ".json",
  text: ".txt,.md",
  web: ".html,.htm",
  image: ".png,.jpg,.jpeg,.webp",
}

export function inputTypeAccept(type?: InputTypeSpec): string | undefined {
  const types = !type ? [] : Array.isArray(type) ? type : [type]
  const exts = types.map((t) => FILE_ACCEPT[t]).filter(Boolean)
  return exts.length ? exts.join(",") : undefined
}

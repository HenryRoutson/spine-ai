import { stepEmitsList } from "@/lib/server/type_expr"
import { flattenPipelineModules } from "@/lib/fork-pipeline"

import { INPUT_TYPES, InputType, type DocRef, type InputTypeSpec, type ModuleId, type PipelineModule } from "@/lib/types"

export type InputDocsAssignment = Partial<Record<ModuleId, DocRef | DocRef[]>>

export function inputMinCountForModule(inputModule: PipelineModule): number {
  return Math.max(1, inputModule.inputMinCount ?? 1)
}

export function isMultiDocInputModule(inputModule: PipelineModule): boolean {
  return inputModule.kind === "input" && (inputMinCountForModule(inputModule) > 1 || stepEmitsList(inputModule))
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

// AI : Excel + JSON parse to structured data in the input step.
export const JSON_NATIVE_INPUT_TYPES: readonly InputType[] = [InputType.Excel, InputType.Json]
// AI : already text — no convert-to-text step; LLM parse only when I/O is not Document.
export const PLAIN_TEXT_INPUT_TYPES: readonly InputType[] = [InputType.Text, InputType.Markdown, InputType.Latex]
// AI : binary / markup that needs a locked convert-to-text step to instantiate Document.content.
export const DOC_TO_TEXT_INPUT_TYPES: readonly InputType[] = [InputType.Pdf, InputType.Word, InputType.Image, InputType.Web]
export const MEDIA_INPUT_TYPES: readonly InputType[] = [InputType.Audio, InputType.Video]
// AI : TODO (media-view-D-stt) — Audio (and maybe Video) need audio-to-text, not vision OCR. Do not dump into DOC_TO_TEXT.

export function isJsonNativeInputType(type: InputType): boolean {
  return JSON_NATIVE_INPUT_TYPES.includes(type)
}

export function isPlainTextInputType(type: InputType): boolean {
  return PLAIN_TEXT_INPUT_TYPES.includes(type)
}

export function isDocToTextInputType(type: InputType): boolean {
  return DOC_TO_TEXT_INPUT_TYPES.includes(type)
}

export function isMediaInputType(type: InputType): boolean {
  return MEDIA_INPUT_TYPES.includes(type)
}

export function inputTypesAreAllJsonNative(types: InputType[]): boolean {
  return types.length > 0 && types.every(isJsonNativeInputType)
}

export function inputModuleTypesAreAllJsonNative(inputModule: PipelineModule): boolean {
  return inputModule.kind === "input" && inputTypesAreAllJsonNative(inputTypesForModule(inputModule))
}

export function inputTypesNeedOcr(types: InputType[]): boolean {
  return types.includes(InputType.Pdf) || types.includes(InputType.Image)
}

export function inputModuleNeedsOcr(inputModule: PipelineModule): boolean {
  return inputModule.kind === "input" && inputTypesNeedOcr(inputTypesForModule(inputModule))
}

export function inputTypesNeedDocToText(types: InputType[]): boolean {
  return types.some(isDocToTextInputType)
}

export function inputModuleNeedsDocToText(inputModule: PipelineModule): boolean {
  return inputModule.kind === "input" && inputTypesNeedDocToText(inputTypesForModule(inputModule))
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
  return flattenPipelineModules(modules).filter((m) => m.kind === "input")
}

// AI : multi-doc slots — templates first, then seed doc order, then filename.
export function sortMultiInputDocs(docs: DocRef[], seedDocNames?: string[]): DocRef[] {
  const rank = seedDocNames?.length ? new Map(seedDocNames.map((n, i) => [n, i])) : undefined
  return [...docs].sort((a, b) => {
    const aTemplate = /template/i.test(a.name) ? 0 : 1
    const bTemplate = /template/i.test(b.name) ? 0 : 1
    if (aTemplate !== bTemplate) return aTemplate - bTemplate
    if (rank) {
      const ar = rank.get(a.name) ?? 999
      const br = rank.get(b.name) ?? 999
      if (ar !== br) return ar - br
    }
    return a.name.localeCompare(b.name)
  })
}

export function inputTypeLabel(type?: InputTypeSpec): string {
  if (!type) return "file"
  const types = Array.isArray(type) ? type : [type]
  const labels = types.map((t) => INPUT_TYPES.find((x) => x.value === t)?.label ?? t)
  if (labels.length <= 2) return labels.join(" or ")
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
}

// AI : lists until the HTML accept= boundary; join only there.
const FILE_ACCEPT: Partial<Record<InputType, readonly string[]>> = {
  pdf: [".pdf"],
  word: [".doc", ".docx"],
  excel: [".xls", ".xlsx", ".csv"],
  json: [".json"],
  text: [".txt"],
  markdown: [".md", ".markdown"],
  latex: [".tex", ".latex"],
  web: [".html", ".htm"],
  image: [".png", ".jpg", ".jpeg", ".webp"],
  audio: [".wav", ".mp3", ".m4a", ".ogg"],
  video: [".mp4", ".webm", ".mov"],
}

export function inputTypeAccept(type?: InputTypeSpec): string | undefined {
  const types = !type ? [] : Array.isArray(type) ? type : [type]
  const exts = types.flatMap((t) => FILE_ACCEPT[t] ?? [])
  return exts.length ? exts.join(",") : undefined
}

// AI : agent composer / Documents — all uploadable exts (skip web; html rejected server-side).
export function allUploadAccept(): string {
  return (Object.entries(FILE_ACCEPT) as [InputType, readonly string[]][])
    .filter(([t]) => t !== InputType.Web)
    .flatMap(([, exts]) => [...exts])
    .join(",")
}

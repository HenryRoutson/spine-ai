import type { CustomCodeLanguage, ModuleId } from "@/lib/types"

export type CodeLineProfile = Record<string, number>

// AI : persisted on RunStep after browser custom-code/assert — powers Logging tab code profile.
export type StepCodeProfile = {
  code: string
  language: CustomCodeLanguage
  lineMs: CodeLineProfile
}

export type CodeExecUiState = {
  moduleId: ModuleId
  language: CustomCodeLanguage
  code: string
  activeLine?: number
  activeSlot?: number
  lineMs?: CodeLineProfile
  status: "running" | "done" | "error"
}

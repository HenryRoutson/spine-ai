import type { CustomCodeLanguage, ModuleId } from "@/lib/types"

export type CodeLineProfile = Record<string, number>

export type CodeExecUiState = {
  moduleId: ModuleId
  language: CustomCodeLanguage
  code: string
  activeLine?: number
  activeSlot?: number
  lineMs?: CodeLineProfile
  status: "running" | "done" | "error"
}

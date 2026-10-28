import type { CustomCodeLanguage, ModuleId } from "@/lib/types"

export type CodeLineProfile = Record<string, number>

export type CodeProfileSnapshot = {
  code: string
  language: CustomCodeLanguage
  lineMs?: CodeLineProfile
}

// AI : persisted on RunStep after browser custom-code/assert — powers Logging tab code profile.
export type StepCodeProfile = CodeProfileSnapshot & { lineMs: CodeLineProfile }

export type CodeExecUiStatus = "running" | "done" | "error"

export type CodeExecUiState = CodeProfileSnapshot & {
  moduleId: ModuleId
  activeLine?: number
  activeSlot?: number
  status: CodeExecUiStatus
}

export function profileBarPct(ms: number, maxMs: number): number {
  return Math.max(4, Math.round((ms / maxMs) * 100))
}

export function formatProfileMs(ms: number): string {
  return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)}ms`
}

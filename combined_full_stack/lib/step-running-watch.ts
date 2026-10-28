import { DEFAULT_CUSTOM_CODE_MAX_RUN_MS } from "@/lib/custom-code-max-run"

// AI : warn in step trace when a step exceeds expected wall clock (custom code uses maxRunMs).
export const STEP_RUNNING_WARN_MS = 15_000

export function stepRunningLimitMs(maxRunMs?: number): number {
  const raw = maxRunMs ?? DEFAULT_CUSTOM_CODE_MAX_RUN_MS
  return Math.max(STEP_RUNNING_WARN_MS, raw)
}

export function formatStepElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)}s`
  const min = Math.floor(sec / 60)
  const rem = Math.round(sec % 60)
  return `${min}m ${rem}s`
}

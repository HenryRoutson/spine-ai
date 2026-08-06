import type { PipelineModule } from "@/lib/types"

// AI : default code-step wall clock — abort + line profile when exceeded.
export const DEFAULT_CUSTOM_CODE_MAX_RUN_MS = 60_000

export type max_run_ms = number

export function customCodeMaxRunMs(m: Pick<PipelineModule, "maxRunMs"> | undefined): max_run_ms {
  const raw = m?.maxRunMs
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return DEFAULT_CUSTOM_CODE_MAX_RUN_MS
  return raw
}

export function formatMaxRunSecondsInput(ms: max_run_ms): string {
  const sec = ms / 1000
  if (!Number.isFinite(sec)) return "60"
  const s = Number.isInteger(sec) ? String(sec) : sec.toFixed(1).replace(/\.0$/, "")
  return s || "60"
}

export function parseMaxRunSecondsInput(raw: string): max_run_ms | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const sec = Number(trimmed)
  if (!Number.isFinite(sec) || sec <= 0) return undefined
  return Math.round(sec * 1000)
}
